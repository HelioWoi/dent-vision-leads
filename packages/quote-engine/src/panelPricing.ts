// =============================================================================
// Quote Engine — Panel Pricing
// Calculates per-panel PDR pricing after AI analysis returns zeroed prices.
// Config-injectable.
// =============================================================================

import { DentAnalysisResponse, MaterialType, VehicleType, QuoteEngineConfig } from './types';
import { calculateEstimateFromRules } from './pricing';

export async function calculatePanelPricing(
  analysis: DentAnalysisResponse,
  material: MaterialType,
  vehicleType: VehicleType,
  config: QuoteEngineConfig
): Promise<DentAnalysisResponse> {
  if (!analysis.panels || analysis.panels.length === 0) {
    return analysis;
  }

  const updatedPanels = await Promise.all(
    analysis.panels.map(async (panel) => {
      if (panel.estimated_panel_cost_AUD?.max && panel.estimated_panel_cost_AUD.max > 0) {
        return panel;
      }

      const largestDent = panel.dents?.reduce((max, dent) => {
        const sizeMm = (dent.size_cm || 0) * 10;
        return sizeMm > max ? sizeMm : max;
      }, 0) || 0;

      try {
        const pricingResult = calculateEstimateFromRules(
          {
            serviceType: 'pdr',
            material: material === 'steel' || material === 'aluminium' ? material : 'steel',
            dentCountTotal: panel.dent_count || 0,
            largestDentSizeMm: largestDent,
            hasPaintNeeded: panel.scratch_count > 0,
            overallSeverity: 'Moderate',
          },
          config
        );

        return {
          ...panel,
          estimated_panel_cost_AUD: pricingResult.priceRange,
        };
      } catch (error) {
        console.error(`Failed to calculate pricing for panel ${panel.panel_name}:`, error);
        return panel;
      }
    })
  );

  return { ...analysis, panels: updatedPanels };
}
