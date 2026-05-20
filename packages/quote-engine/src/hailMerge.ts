// =============================================================================
// Quote Engine — Hail Merge
// Pure functions: merge, update, and remove panels in hail analysis results.
// No external dependencies.
// =============================================================================

import { HailAnalysisResult, HailPanelAnalysis } from './types';
import { categorizeHailSeverity } from './hailPricing';

export const mergeHailAnalyses = (
  existingAnalysis: HailAnalysisResult,
  newAnalysis: HailAnalysisResult
): HailAnalysisResult => {
  const existingPanelNames = new Set(
    existingAnalysis.panels.map(p => p.panel_name.toLowerCase())
  );
  const newPanels = newAnalysis.panels.filter(
    p => !existingPanelNames.has(p.panel_name.toLowerCase())
  );
  const allPanels = [...existingAnalysis.panels, ...newPanels];

  const totalDents = allPanels.reduce((sum, p) => sum + p.dent_count, 0);
  const totalMin   = allPanels.reduce((sum, p) => sum + p.estimated_cost.min, 0);
  const totalMax   = allPanels.reduce((sum, p) => sum + p.estimated_cost.max, 0);

  return {
    panels: allPanels,
    total_dents: totalDents,
    overall_severity: categorizeHailSeverity(totalDents),
    vehicle_type: existingAnalysis.vehicle_type,
    material: existingAnalysis.material,
    estimated_total_cost: { min: totalMin, max: totalMax },
    confidence: (existingAnalysis.confidence + newAnalysis.confidence) / 2,
    notes: `Combined analysis of ${allPanels.length} panels. ${existingAnalysis.notes}`,
  };
};

export const updatePanelInAnalysis = (
  existingAnalysis: HailAnalysisResult,
  updatedPanel: HailPanelAnalysis
): HailAnalysisResult => {
  const panels = existingAnalysis.panels.map(p =>
    p.panel_name.toLowerCase() === updatedPanel.panel_name.toLowerCase() ? updatedPanel : p
  );

  const totalDents = panels.reduce((sum, p) => sum + p.dent_count, 0);
  const totalMin   = panels.reduce((sum, p) => sum + p.estimated_cost.min, 0);
  const totalMax   = panels.reduce((sum, p) => sum + p.estimated_cost.max, 0);

  return {
    ...existingAnalysis,
    panels,
    total_dents: totalDents,
    overall_severity: categorizeHailSeverity(totalDents),
    estimated_total_cost: { min: totalMin, max: totalMax },
  };
};

export const removePanelFromAnalysis = (
  existingAnalysis: HailAnalysisResult,
  panelName: string
): HailAnalysisResult => {
  const panels = existingAnalysis.panels.filter(
    p => p.panel_name.toLowerCase() !== panelName.toLowerCase()
  );

  if (panels.length === 0) {
    throw new Error('Cannot remove all panels from analysis');
  }

  const totalDents = panels.reduce((sum, p) => sum + p.dent_count, 0);
  const totalMin   = panels.reduce((sum, p) => sum + p.estimated_cost.min, 0);
  const totalMax   = panels.reduce((sum, p) => sum + p.estimated_cost.max, 0);

  return {
    ...existingAnalysis,
    panels,
    total_dents: totalDents,
    overall_severity: categorizeHailSeverity(totalDents),
    estimated_total_cost: { min: totalMin, max: totalMax },
  };
};
