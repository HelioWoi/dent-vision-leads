// =============================================================================
// Quote Engine — Hail Analysis
// Converts DentAnalysisResponse (from AI) to HailAnalysisResult,
// applying hail-specific pricing. Config-injectable.
// =============================================================================

import { DentAnalysisResponse, HailAnalysisResult, HailPanelAnalysis, QuoteEngineConfig } from './types';
import { calculatePanelHailPrice, categorizeHailSeverity } from './hailPricing';

// ─── Convert AI Response → HailAnalysisResult ────────────────────────────────

export const convertToHailAnalysis = (
  geminiResponse: DentAnalysisResponse,
  vehicleType: string,
  material: string,
  config: Pick<QuoteEngineConfig, 'hailPricingRules' | 'hailPricingMargin'>
): HailAnalysisResult => {
  const isAluminum = material.toLowerCase() === 'aluminium' || material.toLowerCase() === 'aluminum';
  const panelAnalyses: HailPanelAnalysis[] = [];
  let totalDents = 0;

  for (const panel of geminiResponse.panels) {
    let dentCount = (panel.dent_count && panel.dent_count > 0)
      ? panel.dent_count
      : panel.dents.length;

    if (dentCount === 0 && panel.modifiers.hail_cluster) {
      const isLargePanel = ['bonnet', 'roof', 'boot'].some(p =>
        panel.panel_name.toLowerCase().includes(p)
      );
      dentCount = isLargePanel ? 75 : 40;
      console.error(`🚨 CRITICAL AI ERROR: Panel ${panel.panel_name} marked as hail_cluster but dent_count=0! Using estimate: ${dentCount}`);
    }

    if (dentCount === 0) {
      console.warn(`⚠️ Panel ${panel.panel_name} has 0 dents in hail analysis`);
    }

    totalDents += dentCount;

    const avgDentSize = panel.dents.length > 0
      ? panel.dents.reduce((sum, d) => sum + d.size_cm, 0) / panel.dents.length
      : 2.0;

    const sizeCategory = avgDentSize > 2.5 ? 'oversize_25mm' : 'up_to_25mm';
    const severity = categorizeHailSeverity(dentCount);
    const cost = calculatePanelHailPrice(dentCount, sizeCategory, isAluminum, config);

    panelAnalyses.push({
      panel_name: panel.panel_name,
      dent_count: dentCount,
      severity,
      size_category: sizeCategory,
      estimated_cost: cost,
    });
  }

  const overallSeverity = categorizeHailSeverity(totalDents);
  const totalMin = panelAnalyses.reduce((sum, p) => sum + p.estimated_cost.min, 0);
  const totalMax = panelAnalyses.reduce((sum, p) => sum + p.estimated_cost.max, 0);

  return {
    panels: panelAnalyses,
    total_dents: totalDents,
    overall_severity: overallSeverity,
    vehicle_type: vehicleType,
    material,
    estimated_total_cost: { min: totalMin, max: totalMax },
    confidence: geminiResponse.summary.confidence_overall,
    notes: geminiResponse.notes || 'Preliminary hail damage estimate. Final price will be confirmed by technician after detailed inspection.',
  };
};

// ─── Hail Detection ───────────────────────────────────────────────────────────

export const detectHailDamage = (geminiResponse: DentAnalysisResponse): boolean => {
  const hasHailCluster = geminiResponse.panels.some(p => p.modifiers.hail_cluster);
  const totalDents = geminiResponse.summary.total_dents;
  const hasMultipleDents = totalDents >= 10;
  const affectedPanels = geminiResponse.panels.filter(p => p.dent_count > 0).length;
  const multipleAffectedPanels = affectedPanels >= 2;
  const hasPanelWithMultipleDents = geminiResponse.panels.some(p => p.dent_count >= 5);
  const smallDentsCount = geminiResponse.panels.reduce(
    (sum, p) => sum + p.dents.filter(d => d.size_cm < 3).length, 0
  );
  const hasManySmallDents = smallDentsCount >= 5;
  const totalDentsInArrays = geminiResponse.panels.reduce((sum, p) => sum + p.dents.length, 0);
  const hasMultipleDentMarkers = totalDentsInArrays >= 10;

  const isHail =
    hasHailCluster ||
    hasMultipleDents ||
    (hasPanelWithMultipleDents && multipleAffectedPanels) ||
    hasManySmallDents ||
    hasMultipleDentMarkers;

  console.log(`${isHail ? '🌨️ HAIL DETECTED' : '✅ Not hail'} - Total dents: ${totalDents}`);
  return isHail;
};

// ─── Recommendations ──────────────────────────────────────────────────────────

export const getHailRecommendations = (
  severity: 'light' | 'moderate' | 'severe' | 'extreme'
): string[] => {
  const recommendations: Record<string, string[]> = {
    light:    ['Standard PDR process recommended', 'Typical repair time: 1-2 days', 'No paint work required'],
    moderate: ['Extensive PDR required', 'May require multiple technicians', 'Typical repair time: 2-4 days'],
    severe:   ['Comprehensive PDR assessment needed', 'Some panels may require paint touch-up', 'Typical repair time: 4-7 days', 'Insurance claim recommended'],
    extreme:  ['Panel replacement may be more cost-effective', 'Full vehicle assessment required', 'Typical repair time: 1-2 weeks', 'Insurance claim strongly recommended'],
  };
  return recommendations[severity] || recommendations.light;
};
