// =============================================================================
// Quote Engine — Pricing Engine
// Config-injectable: no calls to adminService or DB.
// Accepts QuoteEngineConfig as a parameter so both partner and leads apps
// can provide their own pricing rules.
// =============================================================================

import { PricingInput, PricingOutput, QuoteEngineConfig, PricingRule } from './types';

// ─── Market-Rate Defaults (used when no partner config is available) ──────────
// Based on standard Australian PDR market rates.
// Partner app overrides these via adminService → DB config.
// Leads app uses these as the public estimate baseline.
export const DEFAULT_PDR_PRICING_RULES: PricingRule[] = [
  { range: '0-30mm',   price: 85   },
  { range: '31-60mm',  price: 150  },
  { range: '61-90mm',  price: 250  },
  { range: '91-160mm', price: 400  },
  { range: '161-260mm',price: 650  },
  { range: '261-400mm',price: 950  },
  { range: '401-600mm',price: 1400 },
];

export const DEFAULT_PDR_MARGIN = 22; // 22% default margin

// ─── Core Pricing Function ────────────────────────────────────────────────────

export function calculateEstimateFromRules(
  input: PricingInput,
  config: QuoteEngineConfig
): PricingOutput {
  console.log('[PRICING] Input:', input);

  const reasons: string[] = [];

  if (input.hasPaintNeeded) {
    reasons.push('Paint repair required - manual review needed');
    return {
      priceRange: { min: 0, max: 0 },
      estimatedCost: 0,
      reasons,
      manualReviewRequired: true,
    };
  }

  if (input.serviceType === 'hail') {
    const hailRules = config.hailPricingRules || [];
    const hailMargin = config.hailPricingMargin ?? 0;

    if (hailRules.length === 0) {
      throw new Error('[PRICING] Hail pricing rules not configured');
    }

    let tierIndex = 0;
    let tierName = 'LIGHT';

    if (input.hailCategory === 'light')    { tierIndex = 0; tierName = 'LIGHT'; }
    if (input.hailCategory === 'moderate') { tierIndex = 1; tierName = 'MODERATE'; }
    if (input.hailCategory === 'severe')   { tierIndex = 2; tierName = 'SEVERE'; }
    if (input.hailCategory === 'extreme')  { tierIndex = 3; tierName = 'EXTREME'; }

    const rule = hailRules[tierIndex];
    if (!rule) {
      throw new Error(`[PRICING] Hail tier ${tierName} not found in pricing rules`);
    }

    const basePrice = rule.basePrice || 0;
    const minPrice = basePrice;
    const maxPrice = Math.round(basePrice * (1 + hailMargin / 100));

    reasons.push(`Hail tier: ${tierName}`);
    reasons.push(`Base price: $${basePrice}`);
    reasons.push(`Margin: ${hailMargin}%`);

    const output: PricingOutput = {
      priceRange: { min: minPrice, max: maxPrice },
      estimatedCost: maxPrice,
      tier: tierName,
      reasons,
      manualReviewRequired: false,
    };

    console.log('[PRICING] Output:', output);
    return output;
  }

  // ─── PDR Pricing ────────────────────────────────────────────────────────────
  const pdrRules = config.pricingRules?.length > 0
    ? config.pricingRules
    : DEFAULT_PDR_PRICING_RULES;
  const pdrMargin = config.pricingMargin ?? DEFAULT_PDR_MARGIN;

  let selectedRule = pdrRules[0];
  let sizeName = 'Unknown';

  let targetDentSize =
    typeof input.largestDentSizeMm === 'number' ? input.largestDentSizeMm : 0;

  if (!targetDentSize) {
    if (input.sizeCategory === 'Small')  targetDentSize = 45;
    else if (input.sizeCategory === 'Medium') targetDentSize = 125;
    else if (input.sizeCategory === 'Large')  targetDentSize = 210;
  }

  if (input.overallSeverity === 'Severe' || input.overallSeverity === 'Moderate') {
    targetDentSize = Math.max(targetDentSize || 0, 91);
  }

  if (input.dominatesPanel) {
    targetDentSize = Math.max(targetDentSize || 0, 91);
  }

  if (input.scaleReferenceUsed === 'door_handle') {
    targetDentSize = Math.max(targetDentSize || 0, 90);
  }

  for (const rule of pdrRules) {
    if (!rule.range) continue;
    const match = rule.range.match(/(\d+)-(\d+)mm/);
    if (match) {
      const rangeMin = parseInt(match[1]);
      const rangeMax = parseInt(match[2]);
      if (targetDentSize >= rangeMin && targetDentSize <= rangeMax) {
        selectedRule = rule;
        sizeName = rule.range;
        break;
      }
      if (targetDentSize > rangeMax) {
        selectedRule = rule;
        sizeName = rule.range;
      }
    }
  }

  const basePrice = selectedRule.price || 0;

  let totalBasePrice = basePrice;
  if (input.dentCountTotal > 1) {
    totalBasePrice += basePrice * 0.8;
    if (input.dentCountTotal > 2) {
      totalBasePrice += basePrice * 0.6 * (input.dentCountTotal - 2);
    }
  }

  const minPrice = Math.round(totalBasePrice);
  const maxPrice = Math.round(totalBasePrice * (1 + pdrMargin / 100));

  reasons.push(`Size category: ${sizeName}`);
  reasons.push(`Rule range: ${selectedRule.range}`);
  reasons.push(`Base price: $${basePrice}`);
  if (input.dentCountTotal > 1) {
    reasons.push(`Progressive pricing: ${input.dentCountTotal} dents (1st: 100%, 2nd: 80%, 3rd+: 60%)`);
  }
  reasons.push(`Margin: ${pdrMargin}%`);
  reasons.push(`Dent count: ${input.dentCountTotal}`);

  const output: PricingOutput = {
    priceRange: { min: minPrice, max: maxPrice },
    estimatedCost: maxPrice,
    tier: sizeName,
    reasons,
    manualReviewRequired: false,
  };

  console.log('[PRICING] Output:', output);
  return output;
}
