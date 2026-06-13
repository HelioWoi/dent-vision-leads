import React, { useEffect, useRef, useState } from 'react';
import EstimateHeader from './EstimateHeader';
import DarkFooter from '../DarkFooter';
import { analyzeDents, identifyPanelsFromImages } from '../../services/geminiServiceAdapter';
import { VehicleType, MaterialType, LightingType, PanelType } from '../../types';
import { detectHailDamage } from '../../services/hailAnalysisService';
import { priceForCategory, paintTouchUpForCategory } from '../../supabase/functions/_shared/pricing.ts';
import {
  DamageRegion,
  allRegionsToPolygons,
  pointerToPct,
  regionFromDrag,
} from '../../utils/damageRegions';
import {
  PanelPhotoGroup,
  selectBestPhotosPerPanel,
} from '../../utils/panelPhotoUpload';
import { dispatchLeadToBodyshops, fetchActiveBodyshops, DEMO_BODYSHOP_NAME } from '../../services/leadDispatchService';
import { filterVerifiedVehiclePhotos, validateVehiclePhotos } from '../../utils/validateVehiclePhotos';
import { PHOTO_CAPTURE_TIPS } from '../../utils/photoCaptureTips';

type Stage = 1 | 2 | 3 | 4;

interface ShopRow {
  name: string;
  initials: string;
  distance: string;
  status: 'reviewing' | 'analyzing' | 'responded' | 'waiting';
  price?: string;
  ago: string;
}

const toInitials = (name: string) =>
  name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'PDR';

const defaultShopRow = (): ShopRow => ({
  name: DEMO_BODYSHOP_NAME,
  initials: toInitials(DEMO_BODYSHOP_NAME),
  distance: '1.3 km',
  status: 'reviewing',
  ago: 'just now',
});

const DOT_POSITIONS = [
  { top: '8%',  left: '12%' }, { top: '8%',  right: '12%' },
  { top: '42%', left: '3%'  }, { top: '42%', right: '3%'  },
  { bottom: '10%', left: '18%' }, { bottom: '10%', right: '18%' },
];

const statusDot = (s: ShopRow['status']) =>
  s === 'responded' ? 'bg-green-400' : s === 'analyzing' ? 'bg-[#4f46e5] animate-pulse' : s === 'reviewing' ? 'bg-blue-400' : 'bg-amber-400';

const statusLabel = (s: ShopRow['status'], _price?: string, pulse = 0) => {
  if (s === 'responded' || s === 'analyzing') return `Preparing quote${'.'.repeat((pulse % 3) + 1)}`;
  if (s === 'reviewing') return 'Preparing quote...';
  return 'Preparing quote...';
};

interface AnalysisInfo {
  panelName: string;
  damageType: string;
  dentCount: number;
  level: 'Shallow' | 'Medium' | 'Deep';
}

interface LiveScanDispatchMode {
  panelName?: string;
  damageType?: string;
  dentCount?: number;
  level?: AnalysisInfo['level'];
  zip?: string;
}

interface InvalidImageFallbackState {
  source: 'upload' | 'live-scan';
  reason?: string;
}

const LEVEL_META = {
  Shallow: { color: '#22c55e', desc: 'Light surface dent · PDR easy' },
  Medium:  { color: '#f59e0b', desc: 'Moderate depth · PDR possible' },
  Deep:    { color: '#ef4444', desc: 'Significant depth · May need filler' },
} as const;

interface PanelBreakdown {
  panelLabel: string;
  dentCount: number;
  damageType: string;
  sizePretty: string;
  depth: string;
  severity: 'Shallow' | 'Medium' | 'Deep';
  repairTime: string;
  minCost: number;
  maxCost: number;
}

const PANEL_LABEL_MAP: Record<string, string> = {
  bonnet: 'Bonnet',
  guard: 'Guard (Front/Rear)',
  doors: 'Doors (All)',
  roof: 'Roof',
  boot: 'Boot',
  bumper: 'Bumper',
  cant_rail: 'Cant Rail',
};

const PANEL_OPTIONS = ['Bonnet', 'Guard (Front/Rear)', 'Door/s', 'Roof', 'Boot'] as const;
const TYPE_OPTIONS = ['PDR Dent', 'Hail Damage'] as const;
const DISPATCH_TOTAL_SECONDS = 180;
const INVALID_IMAGE_FALLBACK_KEY = 'invalidImageValidationFallback';
const normalizePanel = (value: string): string => {
  const lower = value.toLowerCase();
  if (lower.includes('bonnet') || lower.includes('hood')) return 'Bonnet';
  if (lower.includes('boot') || lower.includes('trunk') || lower.includes('boot_lid')) return 'Boot';
  if (lower.includes('door')) return 'Door/s';
  if (lower.includes('bumper')) return 'Bumper';
  if (lower.includes('quarter') || lower.includes('guard') || lower.includes('fender')) return 'Guard (Front/Rear)';
  if (lower.includes('roof')) return 'Roof';
  if (lower.includes('sill')) return 'Sill';
  if (lower.includes('front') || lower.includes('rear')) return 'Guard (Front/Rear)';
  return 'Door/s';
};

const EstimateAnalysis: React.FC = () => {
  const [stage, setStage] = useState<Stage>(1);
  const [shops, setShops] = useState<ShopRow[]>([defaultShopRow()]);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bottomData, setBottomData] = useState<{ damageCategory: string; location: string; repairTime: string } | null>(null);
  const [zip, setZip] = useState('');
  const [statusPulse, setStatusPulse] = useState(0);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [analysisInfo, setAnalysisInfo] = useState<AnalysisInfo | null>(null);
  const [panelBreakdown, setPanelBreakdown] = useState<PanelBreakdown[]>([]);
  const selectedPanelsOnLoad: PanelType[] = ((window as any).__leadSelectedPanels as PanelType[] | undefined) || [];
  const isMultiPanel = selectedPanelsOnLoad.length > 1;
  const [markers, setMarkers] = useState<{ id: number; top: number; left: number }[][]>([]);
  const [damageRegions, setDamageRegions] = useState<DamageRegion[][]>([]);
  const [regionDrag, setRegionDrag] = useState<{
    photoIdx: number; x1: number; y1: number; x2: number; y2: number;
  } | null>(null);
  const [awaitingUserMarking, setAwaitingUserMarking] = useState(true);
  const [dragging, setDragging] = useState<{ photoIdx: number; markerIdx: number } | null>(null);
  const [dispatchSecondsLeft, setDispatchSecondsLeft] = useState(DISPATCH_TOTAL_SECONDS);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerComment, setCustomerComment] = useState('');
  const [invalidImageFallback, setInvalidImageFallback] = useState<InvalidImageFallbackState | null>(null);
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nextId = useRef(0);
  const suppressNextAdd = useRef(false);
  const started = useRef(false);
  const isContactValid = customerName.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim());

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [stage, invalidImageFallback]);

  useEffect(() => {
    let cancelled = false;
    fetchActiveBodyshops().then((active) => {
      if (cancelled || !active.length) return;
      setShops(active.map((shop, i) => ({
        name: shop.business_name,
        initials: toInitials(shop.business_name),
        distance: i === 0 ? '1.3 km' : `${(1.3 + i * 0.8).toFixed(1)} km`,
        status: 'reviewing' as const,
        ago: 'just now',
      })));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let objectUrls: string[] = [];

    const loadPhotos = async () => {
      setPhotosLoading(true);
      try {
        const byPanel = (window as any).__leadUploadByPanel as PanelPhotoGroup[] | undefined;
        const legacyFiles = (window as any).__leadUploadFiles as File[] | undefined;

        let files: File[] = [];
        if (byPanel?.length) {
          const selected = await selectBestPhotosPerPanel(byPanel);
          if (cancelled) return;
          (window as any).__leadUploadFiles = selected.files;
          (window as any).__leadSelectedPanels = selected.panels;
          files = selected.files;
        } else if (legacyFiles?.length) {
          files = legacyFiles.slice(0, 4);
        }

        if (!files.length) {
          if (!cancelled) setPhotosLoading(false);
          return;
        }

        const { accepted, rejected } = await validateVehiclePhotos(files);
        if (cancelled) return;
        if (rejected) {
          showInvalidImageFallback('upload');
          return;
        }
        files = accepted;
        (window as any).__leadUploadFiles = files;

        objectUrls = files.map((f) => URL.createObjectURL(f));
        if (cancelled) return;
        setPhotoUrls(objectUrls);
        setDamageRegions(objectUrls.map(() => []));
        setMarkers(objectUrls.map(() => []));
      } finally {
        if (!cancelled) setPhotosLoading(false);
      }
    };

    loadPhotos();
    return () => {
      cancelled = true;
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const showInvalidImageFallback = (source: 'upload' | 'live-scan') => {
    sessionStorage.removeItem('estimateData');
    sessionStorage.removeItem('liveScanDispatchMode');
    sessionStorage.removeItem('liveScanFullAnalysis');
    setInvalidImageFallback({ source, reason: 'no_vehicle_detected' });
    console.info('[estimate-image-validation]', {
      validation_status: 'invalid_image',
      validation_reason: 'no_vehicle_detected',
      source,
      flow: 'public-estimate',
    });
  };

  useEffect(() => {
    if (!analysisInfo || !photoUrls.length) return;
    // After analysis, show user-marked regions (or centers) on results screen.
    const regionMarkers = damageRegions.map((regions) =>
      regions.map((r) => ({ id: r.id, top: r.cy, left: r.cx }))
    );
    if (regionMarkers.some((g) => g.length > 0)) {
      setMarkers(regionMarkers);
      return;
    }
    const count = Math.min(Math.max(0, analysisInfo.dentCount), 5);
    const spread = [
      { top: 38, left: 62 }, { top: 55, left: 38 }, { top: 28, left: 55 },
      { top: 63, left: 72 }, { top: 45, left: 25 },
    ];
    setMarkers(photoUrls.map(() =>
      Array.from({ length: count }, (_, i) => ({ id: nextId.current++, ...spread[i] }))
    ));
  }, [analysisInfo, damageRegions, photoUrls.length]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const invalidFallbackRaw = sessionStorage.getItem(INVALID_IMAGE_FALLBACK_KEY);
    if (invalidFallbackRaw) {
      try {
        const invalidFallback = JSON.parse(invalidFallbackRaw) as InvalidImageFallbackState;
        setInvalidImageFallback({
          source: invalidFallback.source || 'upload',
          reason: invalidFallback.reason || 'no_vehicle_detected',
        });
      } catch {
        setInvalidImageFallback({ source: 'upload', reason: 'no_vehicle_detected' });
      } finally {
        sessionStorage.removeItem(INVALID_IMAGE_FALLBACK_KEY);
      }
      setZip((window as any).__leadZipCode || '');
      return;
    }

    const dispatchModeRaw = sessionStorage.getItem('liveScanDispatchMode');
    if (dispatchModeRaw) {
      try {
        const dispatchMode: LiveScanDispatchMode = JSON.parse(dispatchModeRaw);
        const initialZip = dispatchMode.zip || (window as any).__leadZipCode || '';
        const estimateRaw = sessionStorage.getItem('estimateData');

        if (estimateRaw) {
          const estimate = JSON.parse(estimateRaw) as {
            damageCategory?: string;
            location?: string;
            repairTime?: string;
            panelBreakdownData?: PanelBreakdown[];
          };
          setBottomData({
            damageCategory: estimate.damageCategory || 'Minor Dent',
            location: estimate.location || dispatchMode.panelName || 'Vehicle panel',
            repairTime: estimate.repairTime || '1–2 hours',
          });
          setPanelBreakdown(Array.isArray(estimate.panelBreakdownData) ? estimate.panelBreakdownData : []);
        }

        setZip(initialZip);
        setAnalysisInfo({
          panelName: normalizePanel(dispatchMode.panelName || 'Door/s'),
          damageType: dispatchMode.damageType || 'PDR Dent',
          dentCount: Math.max(1, Number(dispatchMode.dentCount || 1)),
          level: dispatchMode.level || 'Shallow',
        });
        setAwaitingUserMarking(false);
        setStage(3);
      } catch {
        setZip((window as any).__leadZipCode || '');
        setAwaitingUserMarking(false);
        setTimeout(() => runAnalysis(), 900);
      } finally {
        sessionStorage.removeItem('liveScanDispatchMode');
      }
      return;
    }

    setZip((window as any).__leadZipCode || '');
    // Upload flow: user marks damage first, then analysis runs on confirm.
  }, []);

  useEffect(() => {
    if (stage !== 2 && stage !== 3) return;

    const pulseInterval = window.setInterval(() => {
      setStatusPulse((prev) => prev + 1);
    }, 900);

    return () => {
      window.clearInterval(pulseInterval);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== 4) return;
    setDispatchSecondsLeft(DISPATCH_TOTAL_SECONDS);
    const timer = window.setInterval(() => {
      setDispatchSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [stage]);

  useEffect(() => {
    if (stage === 4 && dispatchSecondsLeft === 0) {
      window.location.hash = '#/estimate-results';
    }
  }, [stage, dispatchSecondsLeft]);

  const runAnalysis = async (userPolygons?: [number, number][][]) => {
    setStage(2);
    try {
      const files = (window as any).__leadUploadFiles as File[] | undefined;
      if (!files?.length) throw new Error('No images provided. Please go back and upload a photo.');

      const polygons = userPolygons ?? allRegionsToPolygons(damageRegions);
      const { files: verified, verifySkipped } = await filterVerifiedVehiclePhotos(files, {
        userMarkedDamage: polygons.length > 0,
      });

      if (!verified.length) {
        showInvalidImageFallback('upload');
        return;
      }

      if (verifySkipped) {
        console.info('[estimate-analysis] verify skipped — proceeding with user-marked photos');
      }

      const selectedPanels = ((window as any).__leadSelectedPanels as PanelType[] | undefined) || [];
      const panelResult = await identifyPanelsFromImages(verified);
      const panels = selectedPanels.length ? selectedPanels
        : panelResult.panels.length ? panelResult.panels
        : [PanelType.Doors];

      const analysis = await analyzeDents(
        verified,
        VehicleType.Sedan,
        MaterialType.Steel,
        LightingType.Daylight,
        panels,
        'pdr',
        undefined,
        polygons.length > 0 ? polygons : undefined,
      );

      const rawTotalDents = Math.max(0, Number(analysis.summary.total_dents || 0));
      const panelDentSum = analysis.panels.reduce((sum, panel) => {
        const dc = typeof panel.dent_count === 'number'
          ? panel.dent_count
          : (panel.dents?.length || 0);
        return sum + Math.max(0, dc);
      }, 0);
      const effectiveDentCount = Math.max(1, panelDentSum || rawTotalDents);
      analysis.summary.total_dents = effectiveDentCount;

      // Build per-panel breakdown from selectedPanels (always covers all user-selected panels)
      let panelBreakdownData: PanelBreakdown[] = [];
      if (selectedPanels.length > 1) {
        const usedPanelIndexes = new Set<number>();
        let remainingDents = effectiveDentCount;

        panelBreakdownData = selectedPanels.map((selectedPanel, i) => {
          const selectedLabel = PANEL_LABEL_MAP[selectedPanel] ?? normalizePanel(String(selectedPanel));

          const findMatchByLabel = analysis.panels.findIndex((p, idx) => {
            if (usedPanelIndexes.has(idx)) return false;
            return normalizePanel(p.panel_name) === selectedLabel;
          });

          let panelIdx = findMatchByLabel;
          if (panelIdx < 0 && i < analysis.panels.length && !usedPanelIndexes.has(i)) {
            panelIdx = i;
          }

          const p = panelIdx >= 0 ? analysis.panels[panelIdx] : undefined;
          if (panelIdx >= 0) usedPanelIndexes.add(panelIdx);

          const topDent = p?.dents?.[0];
          const sizeCm = topDent?.size_cm ?? 3;
          const depthRaw = (topDent?.depth ?? 'Shallow') as PanelBreakdown['severity'];
          const depth: PanelBreakdown['severity'] = depthRaw === 'Deep' ? 'Deep' : depthRaw === 'Medium' ? 'Medium' : 'Shallow';

          const dc = typeof p?.dent_count === 'number'
            ? p.dent_count
            : remainingDents > 0 ? 1 : 0;
          remainingDents = Math.max(0, remainingDents - dc);

          // Panels the AI didn't match get the canonical category price for
          // their dent share — never a hardcoded Category 1 default.
          const triageCategory = Number((analysis as any).ai_triage?.dent_category || 1);
          const aiPanelCost = p?.estimated_panel_cost_AUD;
          const panelCost = aiPanelCost && (aiPanelCost.min || 0) > 0
            ? { min: aiPanelCost.min || 0, max: aiPanelCost.max || 0 }
            : dc > 0 ? priceForCategory(triageCategory, dc) : { min: 0, max: 0 };

          return {
            panelLabel: selectedLabel,
            dentCount: dc,
            damageType: dc > 0 ? 'Minor Dent' : 'No damage',
            sizePretty: `~${sizeCm}–${sizeCm + 2} cm`,
            depth,
            severity: depth,
            repairTime: dc <= 1 ? '30–60 min' : dc <= 3 ? '1–2 hours' : '2–3 hours',
            minCost: panelCost.min,
            maxCost: panelCost.max,
          };
        });

        setPanelBreakdown(panelBreakdownData);
      }

      const topPanel = [...analysis.panels].sort(
        (a, b) => (Number(b.dent_count || 0) - Number(a.dent_count || 0))
      )[0];
      const dentCount = effectiveDentCount;
      const resolvedCat = Number((analysis as any).ai_triage?.dent_category || 0);
      const dentType = String((analysis as any).ai_triage?.dent_type || '').toLowerCase();
      const damageCategory =
        resolvedCat === 1 ? 'Small Dent (Category 1)'
        : resolvedCat === 2 ? 'Medium Dent (Category 2)'
        : resolvedCat === 3 ? 'Moderate Dent (Category 3)'
        : resolvedCat === 4 ? 'Large Dent (Category 4)'
        : resolvedCat === 5 ? 'Major Crease / Deep Dent (Category 5)'
        : resolvedCat === 6 ? 'Severe Crease / Panel Damage (Category 6)'
        : resolvedCat === 7 ? 'Extreme Damage (Category 7)'
        : /bodyline|crease|collapsed/.test(dentType) ? 'Major Crease / Bodyline Damage'
        : resolvedCat >= 5 ? 'Moderate to Major Dent'
        : dentCount <= 2 ? 'Minor Dent'
        : dentCount <= 5 ? 'Moderate Dent'
        : 'Multiple Dents';
      const location = topPanel
        ? topPanel.panel_name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Vehicle Panel';
      const repairTime =
        resolvedCat >= 7 ? '4–6 hours'
        : resolvedCat >= 6 ? '3–5 hours'
        : resolvedCat >= 4 ? '2–4 hours'
        : dentCount <= 2 ? '1–2 hours'
        : dentCount <= 5 ? '1–3 hours'
        : '3–5 hours';
      const isHail = detectHailDamage(analysis);
      const hasPaintDamage = !!analysis.flags?.pdr_incompatible;
      const paintRepairNeeded = !!(analysis.flags as any)?.paint_repair_needed;
      const paintMarksNoted = !!(analysis.flags as any)?.paint_marks_noted ||
        (analysis.summary.total_scratches > 0 && !hasPaintDamage && !paintRepairNeeded);

      // SINGLE SOURCE OF TRUTH: prices come from the edge function, which uses
      // the canonical category table (supabase/functions/_shared/pricing.ts).
      // The frontend never re-prices. Multi-panel flow sums the per-panel
      // breakdown (built from the same table above).
      const aiTotal = analysis.summary.estimated_total_cost_AUD || { min: 0, max: 0 };
      const breakdownCostSum = panelBreakdownData.reduce(
        (acc, p) => ({ min: acc.min + p.minCost, max: acc.max + p.maxCost }),
        { min: 0, max: 0 }
      );
      const estMin = breakdownCostSum.min > 0 ? breakdownCostSum.min : (aiTotal.min || 0);
      const estMax = breakdownCostSum.max > 0 ? breakdownCostSum.max : (aiTotal.max || 0);
      const categoryForPaint = resolvedCat >= 1 ? resolvedCat : 3;
      const paintBand = paintRepairNeeded ? paintTouchUpForCategory(categoryForPaint) : null;

      // HONESTY RULE: failed/unpriced analysis routes to inspection — never a fake price.
      const analysisFailed = (analysis as any)._source === 'fallback' || estMin <= 0 || estMax <= 0;
      const needsInspection = analysisFailed || !!analysis.flags?.review_required;

      console.info('[estimate-ai-source]', {
        _source: (analysis as any)._source || 'unknown',
        _openai_error: (analysis as any)._openai_error || null,
        final_category: (analysis as any).ai_triage?.dent_category ?? null,
        category_floors: (analysis as any).ai_triage?.category_floors_applied ?? null,
        estimated_min: estMin,
        estimated_max: estMax,
        total_dents: dentCount,
        total_scratches: analysis.summary.total_scratches,
        pdr_incompatible: analysis.flags?.pdr_incompatible,
        hasPaintDamage,
        needsInspection,
      });

      const payload = {
        analysis,
        panelBreakdownData: panelBreakdownData.length > 0 ? panelBreakdownData : undefined,
        damageType: isHail ? 'hail' : hasPaintDamage ? 'paint' : 'pdr',
        estimateMin: estMin,
        estimateMax: estMax,
        pdrEstimateMin: estMin,
        pdrEstimateMax: estMax,
        paintEstimateMin: paintBand?.min,
        paintEstimateMax: paintBand?.max,
        combinedEstimateMin: paintBand ? estMin + paintBand.min : estMin,
        combinedEstimateMax: paintBand ? estMax + paintBand.max : estMax,
        confidence: analysis.summary.confidence_overall,
        dents: dentCount,
        scratches: analysis.summary.total_scratches,
        hasPaintDamage,
        paintRepairNeeded,
        paintMarksNoted,
        pdrSuitable: !hasPaintDamage,
        inspectionRequired: needsInspection,
        damageCategory,
        location,
        repairTime,
        zip: (window as any).__leadZipCode || '',
      };

      sessionStorage.setItem('estimateData', JSON.stringify(payload));
      setBottomData({ damageCategory, location, repairTime });
      const cnt = Math.max(1, Number(topPanel?.dent_count ?? dentCount));
      const severityStr = (analysis.summary.overall_severity || 'Minor').toLowerCase();
      const lvl: AnalysisInfo['level'] =
        severityStr === 'severe' ? 'Deep' :
        (severityStr === 'moderate' || severityStr === 'medium') ? 'Medium' :
        'Shallow';
      const pNameRaw = topPanel?.panel_name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Door';
      setAnalysisInfo({ panelName: normalizePanel(pNameRaw), damageType: isHail ? 'Hail Damage' : 'PDR Dent', dentCount: cnt, level: lvl });
      setStage(3);
      animateShops(estMin, estMax);
    } catch (err) {
      if ((err as any)?.code === 'INVALID_IMAGE') {
        showInvalidImageFallback('upload');
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[estimate-analysis] runAnalysis error:', msg, err);
      setError(msg || 'Analysis failed. Please try again.');
    }
  };

  const animateShops = (_min: number, _max: number) => {
    setShops((prev) =>
      prev.map((shop, i) => ({
        ...shop,
        status: i === 0 ? 'analyzing' : 'waiting',
        ago: 'just now',
      }))
    );

    window.setTimeout(() => {
      setShops((prev) =>
        prev.map((shop, i) => (i === 0 ? { ...shop, status: 'analyzing', ago: 'just now' } : shop))
      );
    }, 1200);
  };

  const totalMarkedRegions = damageRegions.reduce((sum, arr) => sum + arr.length, 0);

  const handleRegionPointerDown = (photoIdx: number) => (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-region-delete]') || target.closest('[data-region-chip]')) return;
    e.preventDefault();
    const rect = containerRefs.current[photoIdx]?.getBoundingClientRect();
    if (!rect) return;
    const { x, y } = pointerToPct(e.clientX, e.clientY, rect);
    setRegionDrag({ photoIdx, x1: x, y1: y, x2: x, y2: y });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleRegionPointerMove = (photoIdx: number) => (e: React.PointerEvent) => {
    if (!regionDrag || regionDrag.photoIdx !== photoIdx) return;
    const rect = containerRefs.current[photoIdx]?.getBoundingClientRect();
    if (!rect) return;
    const { x, y } = pointerToPct(e.clientX, e.clientY, rect);
    setRegionDrag((prev) => (prev ? { ...prev, x2: x, y2: y } : null));
  };

  const handleRegionPointerUp = (photoIdx: number) => (e: React.PointerEvent) => {
    if (!regionDrag || regionDrag.photoIdx !== photoIdx) return;
    const region = regionFromDrag(
      nextId.current++,
      regionDrag.x1,
      regionDrag.y1,
      regionDrag.x2,
      regionDrag.y2,
    );
    if (region) {
      setDamageRegions((prev) =>
        prev.map((arr, pi) => (pi !== photoIdx ? arr : [...arr, region]))
      );
    }
    setRegionDrag(null);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  const handleDeleteRegion = (photoIdx: number, regionId: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setDamageRegions((prev) =>
      prev.map((arr, pi) => (pi !== photoIdx ? arr : arr.filter((r) => r.id !== regionId)))
    );
  };

  const handleStartAnalysis = () => {
    if (totalMarkedRegions === 0) return;
    setAwaitingUserMarking(false);
    runAnalysis(allRegionsToPolygons(damageRegions));
  };

  const handleMarkerDown = (photoIdx: number, markerIdx: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    suppressNextAdd.current = true;
    setDragging({ photoIdx, markerIdx });
  };

  const handleContainerMove = (photoIdx: number) => (e: React.PointerEvent) => {
    if (dragging?.photoIdx !== photoIdx) return;
    const rect = containerRefs.current[photoIdx]?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(5, Math.min(90, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(90, ((e.clientY - rect.top) / rect.height) * 100));
    setMarkers((prev) =>
      prev.map((arr, pi) =>
        pi !== photoIdx ? arr : arr.map((m, mi) => (mi === dragging!.markerIdx ? { ...m, top: y, left: x } : m))
      )
    );
  };

  const handleContainerUp = () => {
    setDragging(null);
    window.setTimeout(() => {
      suppressNextAdd.current = false;
    }, 0);
  };

  const handleDeleteMarker = (photoIdx: number, markerIdx: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setMarkers((prev) =>
      prev.map((arr, pi) => (pi !== photoIdx ? arr : arr.filter((_, mi) => mi !== markerIdx)))
    );
  };

  const handleContainerClick = (photoIdx: number) => (e: React.MouseEvent) => {
    if (suppressNextAdd.current) return;
    if (dragging) return;
    const rect = containerRefs.current[photoIdx]?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(5, Math.min(90, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(90, ((e.clientY - rect.top) / rect.height) * 100));
    setMarkers((prev) =>
      prev.map((arr, pi) =>
        pi !== photoIdx ? arr : [...arr, { id: nextId.current++, top: y, left: x }]
      )
    );
  };

  const handleAdvance = async () => {
    if (!isContactValid) return;
    const current = sessionStorage.getItem('estimateData');
    if (current && analysisInfo) {
      try {
        const parsed = JSON.parse(current);
        const markerCount = damageRegions.reduce((sum, group) => sum + group.length, 0)
          || markers.reduce((sum, group) => sum + group.length, 0);
        const photoCount = ((window as any).__leadUploadFiles as File[] | undefined)?.length || 0;
        const next = {
          ...parsed,
          location: analysisInfo.panelName,
          damageTypeLabel: analysisInfo.damageType,
          dents: markerCount,
          customer: {
            name: customerName.trim(),
            email: customerEmail.trim(),
            comment: customerComment.trim() || undefined,
          },
          userConfirmed: {
            panelName: analysisInfo.panelName,
            damageType: analysisInfo.damageType,
            dentCount: markerCount,
            damageLevel: analysisInfo.level,
            name: customerName.trim(),
            email: customerEmail.trim(),
            comment: customerComment.trim() || undefined,
          },
        };
        sessionStorage.setItem('estimateData', JSON.stringify(next));

        setDispatchError(null);
        const photoFiles = ((window as any).__leadUploadFiles as File[] | undefined) || [];
        const result = await dispatchLeadToBodyshops({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerComment: customerComment.trim(),
          zip: parsed.zip || (window as any).__leadZipCode || '',
          damageCategory: parsed.damageCategory,
          location: analysisInfo.panelName,
          dentCount: markerCount,
          estimateMin: parsed.estimateMin,
          estimateMax: parsed.estimateMax,
          pdrEstimateMin: parsed.pdrEstimateMin ?? parsed.estimateMin,
          pdrEstimateMax: parsed.pdrEstimateMax ?? parsed.estimateMax,
          paintRepairNeeded: parsed.paintRepairNeeded,
          photoCount,
          photoFiles,
        });

        if (result.ok && result.leadId) {
          sessionStorage.setItem('dispatchedLeadId', result.leadId);
          if (result.bodyshopId) {
            sessionStorage.setItem('dispatchedBodyshopId', result.bodyshopId);
          }
          next.leadId = result.leadId;
          if (result.bodyshopId) next.bodyshopId = result.bodyshopId;
          sessionStorage.setItem('estimateData', JSON.stringify(next));
        }

        if (!result.ok) {
          console.error('[estimate-analysis] lead dispatch failed', result.error);
          setDispatchError(result.error || 'Could not send your request to the shop.');
        }
      } catch (err) {
        console.error('[estimate-analysis] handleAdvance error', err);
      }
    }
    setStage(4);
  };

  const handleSkipDispatch = () => {
    window.location.hash = '#/estimate-results';
  };

  const handlePanelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const panelName = e.target.value;
    setAnalysisInfo((prev) => (prev ? { ...prev, panelName } : prev));
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const damageType = e.target.value;
    setAnalysisInfo((prev) => (prev ? { ...prev, damageType } : prev));
  };

  const handleUploadAnotherPhoto = () => {
    window.location.hash = '#/';
  };

  const handleBackToStart = () => {
    window.location.hash = '#/';
  };

  if (invalidImageFallback) {
    return (
      <div className="min-h-screen" style={{ background: '#eef2f8' }}>
        <EstimateHeader currentStep={1} />

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white border border-[#d8e0f3] rounded-[28px] overflow-hidden shadow-sm">
            <div className="bg-[#273548] px-6 py-5 text-white">
              <p className="text-[11px] font-black tracking-[0.15em] uppercase text-[#9ec2ff]">AI Image Validation</p>
              <h1 className="text-2xl md:text-3xl font-extrabold mt-1">We couldn’t detect a vehicle in this photo</h1>
              <p className="text-sm text-[#d7e4ff] mt-2 max-w-2xl">
                Dent-Vision AI can only estimate automotive dent damage from clear vehicle photos. Please upload a photo showing the damaged car panel.
              </p>
            </div>

            <div className="p-5 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-4 mb-4">
                <div className="rounded-2xl border border-[#e5e7f0] bg-[#f8faff] p-4">
                  <p className="text-xs font-black text-[#4f46e5] uppercase tracking-[0.14em] mb-2">How to fix this</p>
                  <div className="space-y-2.5">
                    {[
                      'Upload a clear photo of the dent',
                      'Show the full damaged vehicle panel',
                      'Avoid screenshots, people, documents, tools, or unrelated images',
                    ].map((item, index) => (
                      <div key={item} className="rounded-xl border border-[#dde4f7] bg-white p-3 flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-[#4f46e5] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{index + 1}</span>
                        <p className="text-sm text-[#1f2937] leading-snug">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e5e7f0] bg-[#f8faff] p-4 flex flex-col">
                  <p className="text-xs font-black text-[#f97316] uppercase tracking-[0.14em] mb-2">Scan Status</p>
                  <div className="rounded-xl bg-[#0f172a] h-36 relative overflow-hidden border border-[#1f2937] mb-3">
                    <div
                      className="absolute inset-0 opacity-30"
                      style={{
                        backgroundImage: 'linear-gradient(rgba(124,58,237,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.25) 1px, transparent 1px)',
                        backgroundSize: '22px 22px',
                      }}
                    />
                    <div className="invalid-scan-line" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-[#7c3aed]/20 border border-[#a78bfa] flex items-center justify-center">
                        <span className="text-2xl">🚘</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-[#4b5563] leading-relaxed">
                    No quote was created and no bodyshop has received this image.
                  </p>
                  <p className="text-xs text-[#6b7280] mt-2">
                    You can upload another photo now or go back to the start and contact a shop directly.
                  </p>
                  <p className="text-[11px] text-[#8b93a7] mt-2">
                    Source: {invalidImageFallback.source === 'live-scan' ? 'Live Scan' : 'Upload'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleUploadAnotherPhoto}
                  className="flex-1 rounded-xl py-3 px-4 text-white font-bold bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] hover:brightness-110 transition-all"
                >
                  Upload Another Photo
                </button>
                <button
                  type="button"
                  onClick={handleBackToStart}
                  className="flex-1 rounded-xl py-3 px-4 font-bold text-[#1f2937] bg-[#eef2ff] border border-[#d8def3] hover:bg-[#e4e9fb] transition-colors"
                >
                  Back to Start
                </button>
              </div>
            </div>
          </div>
        </div>

        <DarkFooter />
      </div>
    );
  }

  if (error) return (
    <div className="min-h-screen" style={{ background: '#eef2f8' }}>
      <EstimateHeader currentStep={2} />
      <div className="min-h-[70vh] px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center shadow-md">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="font-semibold text-[#111827] mb-1">Analysis could not be completed</p>
          <p className="text-sm text-[#5f6b7b] mb-5">{error}</p>
          <a href="#/" className="inline-block px-6 py-2.5 rounded-full bg-[#273548] text-white text-sm font-semibold">← Go Back</a>
        </div>
      </div>
    </div>
  );

  if (awaitingUserMarking && photosLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#eef2f8' }}>
        <div className="text-center px-4">
          <div className="w-10 h-10 border-4 border-[#4f46e5] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#111827]">Validating your photos…</p>
          <p className="text-xs text-[#6b7280] mt-1">Checking each image is a vehicle panel before marking</p>
        </div>
      </div>
    );
  }

  if (awaitingUserMarking && photoUrls.length > 0) {
    return (
      <div className="min-h-screen" style={{ background: '#eef2f8' }}>
        <EstimateHeader currentStep={1} />

        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="text-center mb-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#4f46e5] mb-2">Step 1 — Mark your damage</p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#111827]">Drag around each dent before we analyze</h1>
            <p className="text-sm text-[#5f6b7b] mt-2 max-w-xl mx-auto">
              Draw a <strong className="text-[#374151]">small tight circle</strong> on each ding — not the whole glare area. Shops review before pricing.
            </p>
          </div>

          <div className="mb-4 rounded-2xl border border-[#dbe4ff] bg-[#f8faff] px-4 py-3 max-w-2xl mx-auto">
            <p className="text-[11px] font-bold text-[#4f46e5] uppercase tracking-wide mb-2">Small dent? Mark it tight</p>
            <ul className="space-y-1">
              {PHOTO_CAPTURE_TIPS.slice(2, 5).map((tip) => (
                <li key={tip} className="text-[11px] text-[#4b5563] leading-snug flex gap-1.5">
                  <span className="text-[#4f46e5] flex-shrink-0">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-[26px] border border-[#e8ebf3] p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-[#111827]">Your photos</p>
              <span className="text-[11px] bg-[#eef2ff] text-[#4f46e5] font-semibold px-2.5 py-0.5 rounded-full">
                {totalMarkedRegions} damage area{totalMarkedRegions !== 1 ? 's' : ''} marked
              </span>
            </div>

            <div className={`grid gap-3 ${photoUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {photoUrls.map((url, i) => {
                const regions = damageRegions[i] ?? [];
                const dragPreview =
                  regionDrag?.photoIdx === i
                    ? {
                        left: Math.min(regionDrag.x1, regionDrag.x2),
                        top: Math.min(regionDrag.y1, regionDrag.y2),
                        width: Math.abs(regionDrag.x2 - regionDrag.x1),
                        height: Math.abs(regionDrag.y2 - regionDrag.y1),
                      }
                    : null;

                return (
                  <div key={i} className="rounded-2xl border border-[#dbe4ff] bg-[#f8faff] p-1.5">
                    {isMultiPanel && (
                      <div className="flex items-center gap-1.5 px-1.5 pb-1.5 mb-1">
                        <span className="w-6 h-6 rounded-lg bg-[#4f46e5] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <span className="text-[13px] font-semibold text-[#111827]">
                          {selectedPanelsOnLoad[i] ? (PANEL_LABEL_MAP[selectedPanelsOnLoad[i]] ?? `Panel ${i + 1}`) : `Panel ${i + 1}`}
                        </span>
                      </div>
                    )}
                    <div
                      className="relative rounded-xl overflow-visible"
                      style={{ aspectRatio: '16/9' }}
                    >
                      <div className="absolute inset-0 overflow-hidden rounded-xl bg-gray-100">
                        <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover pointer-events-none" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/5 pointer-events-none" />
                      </div>

                      <div
                        ref={(el) => { containerRefs.current[i] = el; }}
                        className="absolute inset-0 z-10 cursor-crosshair select-none rounded-xl"
                        style={{ touchAction: 'none' }}
                        onPointerDown={handleRegionPointerDown(i)}
                        onPointerMove={handleRegionPointerMove(i)}
                        onPointerUp={handleRegionPointerUp(i)}
                        onPointerLeave={handleRegionPointerUp(i)}
                      >
                        {regions.map((r, ri) => (
                          <div
                            key={r.id}
                            className="absolute pointer-events-none"
                            style={{
                              left: `${r.cx - r.rx}%`,
                              top: `${r.cy - r.ry}%`,
                              width: `${r.rx * 2}%`,
                              height: `${r.ry * 2}%`,
                            }}
                          >
                            <div className="w-full h-full rounded-full border-2 border-amber-400 bg-amber-400/25 shadow-[0_0_0_1px_rgba(255,255,255,0.6)]" />
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 ring-2 ring-white text-[10px] font-black text-white shadow">
                              {ri + 1}
                            </span>
                            <button
                              type="button"
                              data-region-delete
                              aria-label={`Remove mark ${ri + 1}`}
                              className="absolute pointer-events-auto flex items-center justify-center w-9 h-9 rounded-full bg-red-500 text-white text-lg font-bold shadow-lg hover:bg-red-600 active:scale-95 z-30"
                              style={{ top: '0%', left: '100%', transform: 'translate(-25%, -50%)' }}
                              onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={handleDeleteRegion(i, r.id)}
                            >
                              ×
                            </button>
                          </div>
                        ))}

                        {dragPreview && (
                          <div
                            className="absolute z-20 rounded-full border-2 border-dashed border-amber-300 bg-amber-300/15 pointer-events-none"
                            style={{
                              left: `${dragPreview.left}%`,
                              top: `${dragPreview.top}%`,
                              width: `${dragPreview.width}%`,
                              height: `${dragPreview.height}%`,
                            }}
                          />
                        )}

                        <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
                          <span className="inline-flex items-center gap-1 bg-black/55 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
                            {regions.length > 0 ? `${regions.length} marked` : 'Drag to draw ellipse'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {regions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 px-1 pt-2">
                        {regions.map((r, ri) => (
                          <button
                            key={r.id}
                            type="button"
                            data-region-chip
                            onClick={handleDeleteRegion(i, r.id)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#fecaca] bg-[#fef2f2] px-2.5 py-1 text-[11px] font-semibold text-[#b91c1c] hover:bg-[#fee2e2] transition-colors"
                          >
                            Mark {ri + 1}
                            <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] leading-none flex items-center justify-center">×</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleStartAnalysis}
                disabled={totalMarkedRegions === 0}
                className="flex-1 rounded-xl py-3.5 px-4 text-white font-bold bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] hover:brightness-110 transition-all disabled:opacity-45 disabled:cursor-not-allowed"
              >
                Analyze My Damage
              </button>
              <button
                type="button"
                onClick={handleUploadAnotherPhoto}
                className="sm:w-auto rounded-xl py-3.5 px-5 font-semibold text-[#374151] bg-[#eef2ff] border border-[#d8def3] hover:bg-[#e4e9fb] transition-colors"
              >
                Upload different photo
              </button>
            </div>

            <p className="text-[11px] text-[#9ca3af] mt-3 text-center">
              Mark every visible dent. No price is shown until a shop reviews your photos and confirms the estimate.
            </p>
          </div>
        </div>

        <DarkFooter />
      </div>
    );
  }

  if (stage === 4) {
    const elapsed = DISPATCH_TOTAL_SECONDS - dispatchSecondsLeft;
    const progress = Math.min(100, (elapsed / DISPATCH_TOTAL_SECONDS) * 100);
    const minutes = Math.floor(dispatchSecondsLeft / 60);
    const seconds = String(dispatchSecondsLeft % 60).padStart(2, '0');
    const completion = Math.round(progress);
    const shopCount = shops.length;
    const primaryShop = shops[0]?.name || DEMO_BODYSHOP_NAME;
    const summaryDamage = bottomData?.damageCategory ?? 'Minor Dent';
    const summaryLocation = bottomData?.location ?? 'Front Right Door';
    const summaryMethod = analysisInfo?.damageType?.includes('Hail') ? 'Hail Dent Repair' : 'PDR (Paintless Dent Repair)';
    const summarySize = analysisInfo?.level === 'Deep' ? '4 - 6 inches' : analysisInfo?.level === 'Medium' ? '3 - 5 inches' : '2 - 4 inches';
    const progressSteps = [
      { label: 'Photos uploaded securely', checkpoint: 15 },
      { label: 'Request shared with nearby shops', checkpoint: 55 },
      { label: 'Shops reviewing your damage', checkpoint: 100 },
      { label: 'Preparing your final estimate page', checkpoint: 150 },
    ];
    const liveFeed = shops.slice(0, 3).map((shop, i) => ({
      initials: shop.initials,
      name: shop.name,
      action: shop.status === 'analyzing' ? 'is reviewing your photos' : 'received your request',
      ago: i === 0 ? 'just now' : `${12 + i * 15}s ago`,
    }));
    const phase =
      elapsed < 45
        ? 'Uploading your photos to nearby bodyshops'
        : elapsed < 95
          ? 'Matching your request with verified PDR specialists'
          : elapsed < 145
            ? 'Collecting live responses from local shops'
            : 'Finalizing your best estimate options';

    return (
      <div className="min-h-screen" style={{ background: '#eef2f8' }}>
        <EstimateHeader currentStep={3} />

        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="bg-white rounded-[26px] border border-[#e8ebf3] p-4 md:p-5 shadow-sm">
            <div className="text-center mb-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#4f46e5] mb-1">Sending request to shops</p>
              <h1 className="text-2xl md:text-[42px] md:leading-[1.05] font-extrabold text-[#101828]">Your request was sent to {primaryShop}</h1>
              <p className="text-sm text-[#6b7280] mt-1.5">The shop has 3 minutes to review your photos and prepare a quote.</p>
              {dispatchError && (
                <p className="text-sm text-red-600 mt-2 font-medium">{dispatchError}</p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.95fr_0.95fr] gap-3.5">
              <div className="bg-[#f7f8fc] border border-[#e9ecf4] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-bold text-[#111827]">{phase}</p>
                  <p className="text-lg font-black text-[#4f46e5]">{minutes}:{seconds}</p>
                </div>
                <div className="h-2 bg-[#e5e7ef] rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#5146e5] to-[#7a5cff] transition-all duration-700" style={{ width: `${progress}%` }} />
                </div>
                <div className="relative pt-1 mb-2.5">
                  <div className="absolute left-0 right-0 top-[15px] h-[2px] bg-[#d7dbe7]" />
                  <div className="absolute left-0 top-[15px] h-[2px] bg-[#4f46e5] transition-all duration-700" style={{ width: `${progress}%` }} />
                  <div className="relative grid grid-cols-4 gap-1">
                    {progressSteps.map((step, idx) => {
                      const done = elapsed >= step.checkpoint;
                      return (
                        <div key={step.label} className="text-center">
                          <span
                            className={`mx-auto w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                              done ? 'bg-[#22c55e] border-[#22c55e]' : 'bg-[#b9bec9] border-[#b9bec9]'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                          <p className={`text-[10px] leading-tight mt-2 ${done || idx === 0 ? 'text-[#111827] font-semibold' : 'text-[#8b93a7]'}`}>
                            {step.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="text-[11px] text-[#8b93a7] mb-4">{completion}% complete</p>

                <div className="border-t border-[#e3e7f1] pt-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-bold text-[#111827]">Live activity</p>
                    <p className="text-[10px] text-[#6b7280] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Real-time updates
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    {liveFeed.map((item) => (
                      <div key={item.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full border border-[#d7dbe7] bg-white flex items-center justify-center text-[8px] font-black text-[#1f2937] flex-shrink-0">{item.initials}</div>
                          <p className="text-[12px] text-[#111827] truncate">
                            <span className="font-semibold">{item.name}</span>{' '}
                            <span className="text-[#636b7e]">{item.action}</span>
                          </p>
                        </div>
                        <span className="text-[10px] text-[#9aa2b4] flex-shrink-0">{item.ago}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[12px] text-[#4f46e5] font-semibold mt-3">More updates coming in...</p>
                </div>
              </div>

              <div className="bg-[#f7f8fc] border border-[#e9ecf4] rounded-2xl p-4">
                <p className="text-[13px] font-bold text-[#111827] mb-3">Connected shop on Sunshine Coast</p>
                <div className="relative h-[250px] rounded-xl bg-[#f4f6ff] border border-[#e7e9f6] flex items-center justify-center overflow-hidden">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 260 260" fill="none">
                    <circle cx="130" cy="130" r="76" fill="#eceeff" />
                    <circle cx="130" cy="130" r="50" fill="#e4e8ff" />
                  </svg>

                  <div
                    className="absolute w-16 h-16 rounded-full bg-white border border-[#e1e5f2] shadow-sm flex items-center justify-center text-[11px] font-black text-[#4f46e5]"
                    style={{ top: '22%', left: '50%', transform: 'translate(-50%, -50%)' }}
                  >
                    {shops[0]?.initials || 'PDR'}
                  </div>

                  <div className="relative z-20 w-16 h-16 rounded-full bg-gradient-to-br from-[#5b5dfd] to-[#4f46e5] shadow-[0_0_30px_rgba(79,70,229,0.45)] flex items-center justify-center person-core">
                    <span className="absolute inset-0 rounded-full bg-[#5b5dfd]/30 animate-ping" style={{ animationDuration: '1.6s' }} />
                    <span className="absolute inset-1 rounded-full bg-[#5b5dfd]/35" />
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="relative z-10 w-7 h-7 text-white"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H5z" />
                    </svg>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div>
                    <p className="text-3xl leading-none font-extrabold text-[#4f46e5]">{shopCount}</p>
                    <p className="text-[10px] text-[#8b93a7] mt-1">Shop{shopCount === 1 ? '' : 's'} Connected</p>
                  </div>
                  <div>
                    <p className="text-3xl leading-none font-extrabold text-[#4f46e5]">{shops.filter((s) => s.status !== 'waiting').length}</p>
                    <p className="text-[10px] text-[#8b93a7] mt-1">Reviewing</p>
                  </div>
                  <div>
                    <p className="text-3xl leading-none font-extrabold text-[#4f46e5]">5m</p>
                    <p className="text-[10px] text-[#8b93a7] mt-1">Response SLA</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="bg-[#f7f8fc] border border-[#e9ecf4] rounded-2xl p-4">
                  <p className="text-[13px] font-bold text-[#111827] mb-3 flex items-center gap-1.5">
                    <span className="text-[#4f46e5]">✦</span> AI Analysis Summary
                  </p>
                  <div className="space-y-2.5 text-[12px]">
                    <div>
                      <p className="text-[#8b93a7]">Damage Type</p>
                      <p className="font-semibold text-[#111827]">{summaryDamage}</p>
                    </div>
                    <div>
                      <p className="text-[#8b93a7]">Size Estimate</p>
                      <p className="font-semibold text-[#111827]">{summarySize}</p>
                    </div>
                    <div>
                      <p className="text-[#8b93a7]">Best Repair Method</p>
                      <p className="font-semibold text-[#111827]">{summaryMethod}</p>
                    </div>
                    <div>
                      <p className="text-[#8b93a7]">Location</p>
                      <p className="font-semibold text-[#111827]">{summaryLocation}</p>
                    </div>
                    <div>
                      <p className="text-[#8b93a7]">Confidence Score</p>
                      <p className="font-extrabold text-green-600">92%</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#f7f8fc] border border-[#e9ecf4] rounded-2xl p-4">
                  <p className="text-[13px] font-bold text-[#111827] mb-1">Your data is secure</p>
                  <p className="text-[12px] text-[#6b7280] leading-relaxed">
                    Your photos and information are encrypted and shared only with verified repair shops.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 bg-[#f7f8fc] border border-[#e9ecf4] rounded-xl px-3.5 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-[11px] text-[#6b7280]">ⓘ We contact real nearby repair shops to provide more accurate quote confirmations.</p>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-[#4f46e5] border border-[#d9dded] hover:bg-[#eef0ff] transition-colors">
                  Need help?
                </button>
                <button
                  onClick={handleSkipDispatch}
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-white bg-[#4f46e5] hover:brightness-110 transition-all"
                >
                  Skip for testing
                </button>
              </div>
            </div>
          </div>
        </div>

        <DarkFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#eef2f8' }}>
      <EstimateHeader currentStep={stage} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-[#111827]">
            {stage <= 2 ? 'AI Analysis in Progress…' : stage === 3 ? 'AI Analysis in Progress' : 'AI Analysis Complete!'}
          </h1>
          <p className="text-[#5f6b7b] mt-2 max-w-lg mx-auto text-sm">
            {stage <= 3 ? (
              <>
                We're connecting with trusted PDR shops near{' '}
                <span className="font-bold text-[#4f46e5]">{zip || 'your area'}</span> to get you the best estimate.
              </>
            ) : 'Nearby shops are reviewing your request.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">

          {/* ── Left ── */}
          <div className="flex flex-col">

            {/* ── Uploaded photos grid with draggable markers ── */}
            {photoUrls.length > 0 && (
              <div className="w-full mt-6">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-sm font-bold text-[#111827]">Your Submitted Photos</p>
                  <span className="text-[11px] bg-[#eef2ff] text-[#4f46e5] font-semibold px-2.5 py-0.5 rounded-full">
                    {photoUrls.length} / 4 slots
                  </span>
                </div>

                {analysisInfo && stage >= 3 && (
                  <p className="text-[11px] text-[#9ca3af] mb-2.5 leading-relaxed">
                    Damage areas you marked before analysis.
                  </p>
                )}

                <div className={`grid gap-2.5 ${photoUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {photoUrls.map((url, i) => {
                    const photoRegions = damageRegions[i] ?? [];
                    const photoMarkers = markers[i] ?? [];
                    const detected = stage >= 3;
                    const regionCount = photoRegions.length || photoMarkers.length;
                    return (
                      <div key={i} className="rounded-2xl border border-[#dbe4ff] bg-[#f8faff] p-1.5">
                        {isMultiPanel && (
                          <div className="flex items-center justify-between px-1.5 pb-1.5 mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="w-6 h-6 rounded-lg bg-[#4f46e5] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                              <span className="text-[13px] font-semibold text-[#111827]">
                                {selectedPanelsOnLoad[i] ? (PANEL_LABEL_MAP[selectedPanelsOnLoad[i]] ?? `Panel ${i + 1}`) : `Panel ${i + 1}`}
                              </span>
                            </div>
                            {stage >= 3 && (
                              <span className="text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Analyzed ✓</span>
                            )}
                          </div>
                        )}
                        <div
                          ref={(el) => { containerRefs.current[i] = el; }}
                          className="relative rounded-xl overflow-hidden bg-gray-100 select-none"
                          style={{ aspectRatio: '16/9', touchAction: 'none' }}
                        >
                          <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover pointer-events-none" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

                          {!detected && (
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                              <div className="photo-scan-line" />
                            </div>
                          )}

                        {/* Scanner corner reticles */}
                          {!detected && (
                            <div className="absolute inset-0 pointer-events-none">
                              <span className="scan-corner tl" />
                              <span className="scan-corner tr" />
                              <span className="scan-corner bl" />
                              <span className="scan-corner br" />
                            </div>
                          )}

                        {/* User-marked damage ellipses (read-only on results) */}
                          {photoRegions.map((r, ri) => (
                            <div
                              key={r.id}
                              className="absolute z-10 pointer-events-none"
                              style={{
                                left: `${r.cx - r.rx}%`,
                                top: `${r.cy - r.ry}%`,
                                width: `${r.rx * 2}%`,
                                height: `${r.ry * 2}%`,
                              }}
                            >
                              <div className="w-full h-full rounded-full border-2 border-amber-400 bg-amber-400/25 shadow-[0_0_0_1px_rgba(255,255,255,0.6)]" />
                              <span className="absolute -top-2 left-1/2 -translate-x-1/2 flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 ring-2 ring-white text-[9px] font-black text-white shadow">
                                {ri + 1}
                              </span>
                            </div>
                          ))}

                          <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
                            {detected ? (
                              regionCount > 0 ? (
                                <span className="inline-flex items-center gap-1 bg-white/90 text-[#374151] border border-[#e5e7eb] text-[10px] font-medium px-2 py-0.5 rounded-full shadow-sm backdrop-blur-sm">
                                  {regionCount} damage area{regionCount !== 1 ? 's' : ''} marked
                                </span>
                              ) : (
                                <span className="inline-flex items-center bg-white/90 text-[#6b7280] border border-[#e5e7eb] text-[10px] font-medium px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm mx-auto">
                                  No damage areas marked
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-[#4f46e5]/85 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                                Scanning…
                              </span>
                            )}
                          </div>

                          <div className="absolute top-2 right-2">
                            <span className="bg-black/40 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                              {i + 1}/{photoUrls.length}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── AI Detection Summary (multi-panel) ── */}
                {isMultiPanel && analysisInfo && stage >= 3 && (
                  <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-[#e5e7eb]">
                    <p className="text-sm font-bold text-[#111827] mb-3">AI Detection Summary</p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                      {[
                        { value: photoUrls.length, label: 'Panels Analyzed' },
                        { value: damageRegions.reduce((s, a) => s + a.length, 0) || markers.reduce((s, a) => s + a.length, 0), label: 'Dents Detected' },
                        { value: analysisInfo.level, label: 'Avg. Damage Level', color: analysisInfo.level === 'Deep' ? '#ef4444' : analysisInfo.level === 'Medium' ? '#f59e0b' : '#22c55e' },
                        { value: analysisInfo.level === 'Deep' ? 'High' : analysisInfo.level === 'Medium' ? 'Medium' : 'Low', label: 'Repair Complexity', color: analysisInfo.level === 'Deep' ? '#ef4444' : analysisInfo.level === 'Medium' ? '#f59e0b' : '#22c55e' },
                        { value: bottomData?.repairTime ?? '1–2 hours', label: 'Est. Repair Time' },
                      ].map((item) => (
                        <div key={item.label} className="bg-[#f8faff] rounded-xl p-2.5">
                          <p className="text-sm font-extrabold" style={item.color ? { color: item.color } : { color: '#111827' }}>{item.value}</p>
                          <p className="text-[10px] text-[#9ca3af] mt-0.5 leading-tight">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Damage Breakdown table (multi-panel) ── */}
                {isMultiPanel && panelBreakdown.length > 0 && stage >= 3 && (
                  <div className="mt-4 bg-white rounded-2xl overflow-hidden shadow-sm border border-[#e5e7eb]">
                    <div className="px-4 py-3 border-b border-[#f3f4f6]">
                      <p className="text-sm font-bold text-[#111827]">Damage Breakdown</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#f3f4f6] bg-[#f8faff]">
                            {['Panel / Area', 'Damage Type', 'Size (Est.)', 'Depth', 'AI Severity', 'Est. Repair Time'].map((h) => (
                              <th key={h} className="px-3 py-2 text-left text-[10px] text-[#9ca3af] font-semibold whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {panelBreakdown.map((pb, i) => {
                            const sevColor = pb.severity === 'Deep' ? { bg: '#fee2e2', text: '#dc2626' } : pb.severity === 'Medium' ? { bg: '#fef3c7', text: '#d97706' } : { bg: '#dcfce7', text: '#16a34a' };
                            const sevLabel = pb.severity === 'Deep' ? 'High' : pb.severity === 'Medium' ? 'Medium' : 'Low';
                            return (
                              <tr key={i} className="border-b border-[#f9fafb] hover:bg-[#f8faff] transition-colors">
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-[#4f46e5] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                                    <div>
                                      <p className="font-semibold text-[#111827]">{pb.panelLabel}</p>
                                      <p className="text-[10px] text-[#9ca3af]">{pb.dentCount} dent{pb.dentCount !== 1 ? 's' : ''} detected</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-3 font-semibold text-[#111827]">{pb.damageType}</td>
                                <td className="px-3 py-3">
                                  <p className="font-medium text-[#111827]">Small</p>
                                  <p className="text-[10px] text-[#9ca3af]">{pb.sizePretty}</p>
                                </td>
                                <td className="px-3 py-3">
                                  <p className="font-medium text-[#111827]">{pb.depth}</p>
                                  <p className="text-[10px] text-[#9ca3af]">Surface dent</p>
                                </td>
                                <td className="px-3 py-3">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: sevColor.bg, color: sevColor.text }}>{sevLabel}</span>
                                </td>
                                <td className="px-3 py-3 font-medium text-[#111827]">{pb.repairTime}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-4 py-3 border-t border-[#f3f4f6] bg-[#f8faff]">
                      <p className="text-[11px] text-[#6b7280]">AI analysis subject to final review and approval by a certified technician.</p>
                    </div>
                  </div>
                )}

                {/* ── Damage Summary (single-panel) ── */}
                {!isMultiPanel && analysisInfo && stage >= 3 && (
                  <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-[#e5e7eb]">
                    <p className="text-sm font-bold text-[#111827] mb-3">Damage Summary</p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                      {[
                        { value: analysisInfo.panelName, label: 'Panel' },
                        { value: analysisInfo.damageType, label: 'Type' },
                        { value: damageRegions.reduce((s, a) => s + a.length, 0) || markers.reduce((s, a) => s + a.length, 0), label: 'Marked Dents' },
                        { value: analysisInfo.level, label: 'Damage Level', color: analysisInfo.level === 'Deep' ? '#ef4444' : analysisInfo.level === 'Medium' ? '#f59e0b' : '#22c55e' },
                        { value: bottomData?.repairTime ?? '1–2 hours', label: 'Est. Repair Time' },
                      ].map((item) => (
                        <div key={item.label} className="bg-[#f8faff] rounded-xl p-2.5">
                          <p className="text-sm font-extrabold" style={item.color ? { color: item.color } : { color: '#111827' }}>{item.value}</p>
                          <p className="text-[10px] text-[#9ca3af] mt-0.5 leading-tight">{item.label}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-[#6b7280] mt-3">AI analysis subject to final review and approval by a certified technician.</p>
                  </div>
                )}

                {/* ── Analysis Result + Contact ── */}
                {analysisInfo && stage >= 3 && (
                  <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-[#e5e7eb]">
                    {/* Contact fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-3">
                      <label className="block">
                        <span className="text-[10px] text-[#9ca3af] uppercase tracking-wide mb-1 block">Name</span>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Your full name"
                          className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none focus:border-[#4f46e5] transition-colors"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] text-[#9ca3af] uppercase tracking-wide mb-1 block">Email</span>
                        <input
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none focus:border-[#4f46e5] transition-colors"
                        />
                      </label>
                    </div>

                    {/* Dispute comment */}
                    <div className="mb-4">
                      <p className="text-[10px] text-[#9ca3af] uppercase tracking-wide mb-1">Analysis look incorrect? (optional)</p>
                      <textarea
                        value={customerComment}
                        onChange={(e) => setCustomerComment(e.target.value)}
                        placeholder="Add a comment or correction — our bodyshop partners will review it directly."
                        rows={2}
                        className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none focus:border-[#4f46e5] resize-none transition-colors placeholder:text-[#c4c9d4]"
                      />
                    </div>

                    {!isContactValid && (
                      <p className="text-[11px] text-[#9ca3af] mb-3">Fill in name and a valid email to continue.</p>
                    )}

                    <button
                      onClick={handleAdvance}
                      disabled={!isContactValid}
                      className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                        isContactValid
                          ? 'bg-[#111827] text-white hover:bg-[#1f2937]'
                          : 'bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed'
                      }`}
                    >
                      Send to Bodyshops
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 mt-8 w-full">
              {[
                { icon: '🔒', title: 'Secure & Private', desc: 'Your data is encrypted and never shared.' },
                { icon: '⚡', title: 'Real-Time Network', desc: 'Connecting with verified PDR shops near you.' },
                { icon: '🎯', title: 'Best Price Guarantee', desc: 'We find the best value, not just any price.' },
              ].map((b) => (
                <div key={b.title} className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <div className="text-2xl mb-1.5">{b.icon}</div>
                  <p className="text-xs font-semibold text-[#111827]">{b.title}</p>
                  <p className="text-[11px] text-[#9ca3af] mt-0.5">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right ── */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-[#111827] text-sm">Connecting to Your Local Network</h3>
                <p className="text-[11px] text-[#9ca3af]">Shops are reviewing your photo in real-time</p>
              </div>
              <span className="flex items-center gap-1 text-green-500 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" /> Live
              </span>
            </div>

            {/* Radial network map */}
            <div className="relative bg-[#f8faff] rounded-xl h-36 mb-4 overflow-hidden flex items-center justify-center">
              <div className="absolute rounded-full border-2 border-[#4f46e5]/10 animate-ping" style={{ width: 100, height: 100, animationDuration: '2s' }} />
              <div className="absolute rounded-full border border-[#4f46e5]/15" style={{ width: 80, height: 80 }} />
              <div className="relative z-10 w-10 h-10 rounded-full bg-white border-2 border-[#4f46e5]/30 flex items-center justify-center shadow">
                <svg className="w-5 h-5 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              {DOT_POSITIONS.map((pos, i) => (
                <div key={i} className="absolute w-8 h-8 bg-white border border-[#e5e7eb] rounded-lg shadow-sm flex items-center justify-center" style={pos as React.CSSProperties}>
                  <svg className="w-4 h-4 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              ))}
            </div>

            {/* Live network activity banner */}
            <div className="flex items-center justify-between bg-[#f3f4ff] rounded-lg px-3 py-2 mb-4">
              <div className="flex items-center gap-2 text-xs text-[#4f46e5] font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
                Live network activity
              </div>
              <svg className="w-4 h-4 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>

            {/* Shop list */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-[#111827]">Shop Responses</p>
              <p className="text-xs text-[#4f46e5] font-semibold">{shops.length} Connected</p>
            </div>
            <div className="space-y-2.5">
              {shops.map((shop, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#4f46e5]/10 flex items-center justify-center text-[#4f46e5] text-[10px] font-bold">
                      {shop.initials}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#111827]">{shop.name}</p>
                      <p className="text-[10px] text-[#9ca3af]">{shop.distance} away</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(shop.status)}`} />
                    <span className="text-xs text-[#9ca3af]">
                      {statusLabel(shop.status, shop.price, statusPulse)}
                    </span>
                    <span className="text-[10px] text-[#c4c9d4]">{shop.ago}</span>
                  </div>
                </div>
              ))}
              <p className="text-center text-[11px] text-[#9ca3af] pt-1">
                {shops.filter((s) => s.status === 'analyzing' || s.status === 'reviewing').length} shop reviewing your request
              </p>
            </div>

            {/* What happens next */}
            <div className="mt-4 pt-4 border-t border-[#f3f4f6]">
              <p className="text-xs font-bold text-[#111827] mb-2">What happens next?</p>
              {[
                { label: 'Shops review your photo', done: stage >= 2 },
                { label: 'They send us their best price', done: stage >= 3 },
                { label: 'You get the best estimate', done: stage >= 4 },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-[#4f46e5]' : 'border-2 border-gray-200'}`}>
                    {item.done && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-xs ${item.done ? 'text-[#111827] font-medium' : 'text-[#9ca3af]'}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <DarkFooter />

      <style>{`
        .scan-ring-outer {
          background: conic-gradient(from 0deg, #5b5dfd, #b667d4, #f19a48, #5b5dfd);
          animation: rotateGradient 3s linear infinite;
        }
        @keyframes rotateGradient {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .photo-scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent 0%, #4f46e5 20%, #a855f7 50%, #4f46e5 80%, transparent 100%);
          box-shadow: 0 0 8px 2px #4f46e5aa, 0 0 18px 4px #a855f744;
          animation: photoScan 1.8s linear infinite;
          top: 0;
        }
        @keyframes photoScan {
          0%   { top: -2%;  opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { top: 102%; opacity: 0; }
        }
        .invalid-scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, #4f46e5 35%, #a855f7 65%, transparent 100%);
          box-shadow: 0 0 10px #7c3aed88;
          animation: invalidScan 2.1s linear infinite;
          top: -2%;
        }
        @keyframes invalidScan {
          0%   { top: -2%; opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { top: 102%; opacity: 0; }
        }
        .scan-corner {
          position: absolute;
          width: 16px;
          height: 16px;
          border-color: #4f46e5;
          border-style: solid;
          opacity: 0.9;
        }
        .scan-corner.tl { top: 8px;    left: 8px;    border-width: 2px 0 0 2px; }
        .scan-corner.tr { top: 8px;    right: 8px;   border-width: 2px 2px 0 0; }
        .scan-corner.bl { bottom: 8px; left: 8px;    border-width: 0 0 2px 2px; }
        .scan-corner.br { bottom: 8px; right: 8px;   border-width: 0 2px 2px 0; }
        .person-core {
          animation: personPulse 1.8s ease-in-out infinite;
        }
        @keyframes personPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
};

export default EstimateAnalysis;
