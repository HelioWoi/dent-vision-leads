import { analyzeDents } from '../../services/geminiServiceAdapter';
import { calculateEstimateFromRules } from '../../services/pricingEngine';
import { detectHailDamage } from '../../services/hailAnalysisService';
import {
  DentAnalysisResponse,
  PanelType,
  VehicleType,
  MaterialType,
  LightingType,
} from '../../types';

type HailCategory = 'light' | 'moderate' | 'severe' | 'extreme';

export interface LiveScanResultExtended {
  damage_location: string;
  size_category: 'Small' | 'Medium' | 'Large';
  confidence: number;
  needs_paint_repair: boolean;
  damage_type: 'pdr' | 'hail' | 'uncertain';
  dent_count_estimate?: number;
  hail_category?: HailCategory;
  estimated_cost?: { min: number; max: number };
  price_range?: { min: number; max: number };
  panel_pricing?: Array<{
    panel_name: string;
    min_price: number;
    max_price: number;
  }>;
}

export interface LiveScanAnalysisOutput {
  fullAnalysis: DentAnalysisResponse;
  liveScanResult: LiveScanResultExtended;
  isBumperDetected: boolean;
  hasPaintDamage: boolean;
  isHailDetected: boolean;
  panelsToAnalyze: PanelType[];
}

interface RunLiveScanParams {
  frames: File[];
  liveScanSelectedPanels: PanelType[];
  vehicleType?: VehicleType | null;
}

const mapDentSizeToCategory = (maxDentSizeMm: number): 'Small' | 'Medium' | 'Large' => {
  if (maxDentSizeMm <= 30) return 'Small';
  if (maxDentSizeMm <= 90) return 'Medium';
  return 'Large';
};

const estimateFallbackDentSizeMm = (dentCount: number): number => {
  if (dentCount >= 5) return 20;
  if (dentCount >= 2) return 15;
  return 10;
};

const normalizePanelLabel = (panel: PanelType) =>
  panel.charAt(0).toUpperCase() + panel.slice(1).replace('_', ' ');

const consolidateSelectedPanels = (
  fullAnalysis: DentAnalysisResponse,
  panelsToAnalyze: PanelType[]
): DentAnalysisResponse => {
  if (panelsToAnalyze.length <= 1) return fullAnalysis;

  const consolidatedPanels: any[] = [];

  for (const selectedPanel of panelsToAnalyze) {
    const selectedLower = selectedPanel.toLowerCase().replace('_', ' ').trim();

    const matchingPanels = fullAnalysis.panels
      .map((panel, index) => ({ panel, index }))
      .filter(({ panel }) => {
        const panelNameLower = panel.panel_name.toLowerCase().trim();
        const containsMatch =
          panelNameLower.includes(selectedLower) || selectedLower.includes(panelNameLower);
        const guardMatch = selectedLower.includes('guard') && panelNameLower.includes('guard');
        const doorMatch = selectedLower.includes('door') && panelNameLower.includes('door');
        return containsMatch || guardMatch || doorMatch;
      });

    if (matchingPanels.length > 0) {
      const bestMatch = matchingPanels.reduce((best, current) => {
        const bestDentCount = best.panel.dents?.length || 0;
        const currentDentCount = current.panel.dents?.length || 0;
        return currentDentCount > bestDentCount ? current : best;
      });

      consolidatedPanels.push({
        ...bestMatch.panel,
        panel_name: normalizePanelLabel(selectedPanel),
      });
    } else {
      consolidatedPanels.push({
        panel_name: normalizePanelLabel(selectedPanel),
        dent_count: 0,
        scratch_count: 0,
        modifiers: {
          aluminium: false,
          access_difficulty: 'none',
          hail_cluster: false,
        },
        estimated_panel_cost_AUD: { min: 0, max: 0 },
        dents: [],
        scratches: [],
      });
    }
  }

  return { ...fullAnalysis, panels: consolidatedPanels };
};

const getHailCategory = (totalDents: number): HailCategory => {
  if (totalDents <= 10) return 'light';
  if (totalDents <= 30) return 'moderate';
  if (totalDents <= 60) return 'severe';
  return 'extreme';
};

export async function runLiveScanAnalysis({
  frames,
  liveScanSelectedPanels,
  vehicleType,
}: RunLiveScanParams): Promise<LiveScanAnalysisOutput> {
  if (!frames.length) {
    throw new Error('No frames were captured. Please try again and move the camera.');
  }

  const panelsToAnalyze =
    liveScanSelectedPanels.length > 0 ? liveScanSelectedPanels : [PanelType.Doors];

  const isBumperDetected = panelsToAnalyze.some((p) => p === PanelType.Bumper);

  let fullAnalysis = await analyzeDents(
    frames,
    vehicleType || VehicleType.Sedan,
    MaterialType.Steel,
    LightingType.Daylight,
    panelsToAnalyze,
    'pdr'
  );

  fullAnalysis = consolidateSelectedPanels(fullAnalysis, panelsToAnalyze);

  const hasPaintDamage =
    fullAnalysis.flags.pdr_incompatible && fullAnalysis.summary.total_scratches > 0;

  const totalDents = fullAnalysis.panels.reduce((sum, panel) => {
    const dentCount = typeof panel.dent_count === 'number'
      ? panel.dent_count
      : (panel.dents?.length || 0);
    return sum + Math.max(0, dentCount);
  }, 0);
  const effectiveTotalDents = Math.max(1, totalDents);
  if (totalDents === 0 && fullAnalysis.panels.length > 0) {
    fullAnalysis.panels[0].dent_count = 1;
  }
  fullAnalysis.summary.total_dents = effectiveTotalDents;
  const isHailDetected = detectHailDamage(fullAnalysis);
  const hailCategory = isHailDetected ? getHailCategory(effectiveTotalDents) : undefined;
  const hasPaintNeeded = fullAnalysis.flags.pdr_incompatible || fullAnalysis.summary.total_scratches > 0;

  let pricingResult: { priceRange: { min: number; max: number }; manualReviewRequired: boolean };

  if (!isHailDetected && fullAnalysis.panels.length > 0) {
    let totalMinPrice = 0;
    let totalMaxPrice = 0;

    for (const panel of fullAnalysis.panels) {
      const panelDentCount = typeof panel.dent_count === 'number'
        ? panel.dent_count
        : (panel.dents?.length || 0);

      if (panelDentCount > 0) {
        let maxDentSize = 0;
        for (const dent of panel.dents) {
          const dentSizeMm = (dent.size_cm || 0) * 10;
          if (dentSizeMm > maxDentSize) maxDentSize = dentSizeMm;
        }

        if (maxDentSize === 0) {
          maxDentSize = estimateFallbackDentSizeMm(panelDentCount);
        }

        const panelSizeCategory = mapDentSizeToCategory(maxDentSize);
        const severityIndicatesLarge =
          fullAnalysis.summary.overall_severity === 'Moderate' ||
          fullAnalysis.summary.overall_severity === 'Severe';
        const fewDentsIndicatesDominant = panelDentCount <= 3;
        const sizeUnderestimated = maxDentSize < 150;
        const dominatesPanel =
          severityIndicatesLarge && fewDentsIndicatesDominant && sizeUnderestimated;

        const panelPricingResult = calculateEstimateFromRules({
          serviceType: 'pdr',
          dentCountTotal: panelDentCount,
          hasPaintNeeded: false,
          largestDentSizeMm: maxDentSize,
          dominatesPanel,
          sizeCategory: panelSizeCategory,
          overallSeverity: fullAnalysis.summary.overall_severity as 'Minor' | 'Moderate' | 'Severe',
        });

        totalMinPrice += panelPricingResult.priceRange.min;
        totalMaxPrice += panelPricingResult.priceRange.max;

        panel.estimated_panel_cost_AUD = {
          min: panelPricingResult.priceRange.min,
          max: panelPricingResult.priceRange.max,
        };
      } else {
        panel.estimated_panel_cost_AUD = { min: 0, max: 0 };
      }
    }

    fullAnalysis.summary.estimated_total_cost_AUD = { min: totalMinPrice, max: totalMaxPrice };
    pricingResult = {
      priceRange: { min: totalMinPrice, max: totalMaxPrice },
      manualReviewRequired: false,
    };
  } else {
    let maxDentSize = 0;
    for (const panel of fullAnalysis.panels) {
      for (const dent of panel.dents || []) {
        const dentSizeMm = (dent.size_cm || 0) * 10;
        if (dentSizeMm > maxDentSize) maxDentSize = dentSizeMm;
      }
    }

    if (maxDentSize === 0) {
      maxDentSize = estimateFallbackDentSizeMm(effectiveTotalDents);
    }

    const sizeCategory = mapDentSizeToCategory(maxDentSize);
    const severityIndicatesLarge =
      fullAnalysis.summary.overall_severity === 'Moderate' ||
      fullAnalysis.summary.overall_severity === 'Severe';
    const fewDentsIndicatesDominant = effectiveTotalDents <= 3;
    const sizeUnderestimated = maxDentSize < 150;
    const dominatesPanel =
      severityIndicatesLarge && fewDentsIndicatesDominant && sizeUnderestimated;

    const singleResult = calculateEstimateFromRules({
      serviceType: isHailDetected ? 'hail' : 'pdr',
      dentCountTotal: effectiveTotalDents,
      hasPaintNeeded,
      largestDentSizeMm: maxDentSize,
      dominatesPanel,
      sizeCategory,
      hailCategory,
      overallSeverity: fullAnalysis.summary.overall_severity as 'Minor' | 'Moderate' | 'Severe',
    });

    pricingResult = {
      priceRange: singleResult.priceRange,
      manualReviewRequired: singleResult.manualReviewRequired,
    };
  }

  let displaySizeCategory: 'Small' | 'Medium' | 'Large' = 'Small';
  if (fullAnalysis.panels.length > 0 && fullAnalysis.panels[0].dents?.length) {
    let maxDentSize = 0;
    for (const dent of fullAnalysis.panels[0].dents) {
      const dentSizeMm = (dent.size_cm || 0) * 10;
      if (dentSizeMm > maxDentSize) maxDentSize = dentSizeMm;
    }
    displaySizeCategory = mapDentSizeToCategory(maxDentSize);
  }

  const liveScanResult: LiveScanResultExtended = {
    damage_location:
      fullAnalysis.panels.length > 0
        ? fullAnalysis.panels[0].panel_name.replace(/_/g, ' ')
        : 'Unknown area',
    size_category: displaySizeCategory,
    confidence: fullAnalysis.summary.confidence_overall,
    needs_paint_repair: hasPaintNeeded,
    damage_type: isHailDetected ? 'hail' : 'pdr',
    dent_count_estimate: effectiveTotalDents,
    hail_category: hailCategory,
    estimated_cost: pricingResult.manualReviewRequired ? undefined : pricingResult.priceRange,
    price_range: pricingResult.priceRange,
    panel_pricing:
      panelsToAnalyze.length > 1
        ? fullAnalysis.panels.map((panel) => ({
            panel_name: panel.panel_name,
            min_price: panel.estimated_panel_cost_AUD?.min || 0,
            max_price: panel.estimated_panel_cost_AUD?.max || 0,
          }))
        : undefined,
  };

  return {
    fullAnalysis,
    liveScanResult,
    isBumperDetected,
    hasPaintDamage,
    isHailDetected,
    panelsToAnalyze,
  };
}
