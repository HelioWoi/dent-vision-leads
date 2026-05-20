import {
  calculateEstimateFromRules as calculateEstimateFromRulesBase,
  DEFAULT_PDR_MARGIN,
  DEFAULT_PDR_PRICING_RULES,
} from '../packages/quote-engine/src/pricing';
import { DEFAULT_HAIL_MARGIN, DEFAULT_HAIL_PRICING_RULES } from '../packages/quote-engine/src/hailPricing';
import { PricingInput } from '../types';

const DEFAULT_PUBLIC_QUOTE_CONFIG = {
  pricingRules: DEFAULT_PDR_PRICING_RULES,
  pricingMargin: DEFAULT_PDR_MARGIN,
  hailPricingRules: DEFAULT_HAIL_PRICING_RULES,
  hailPricingMargin: DEFAULT_HAIL_MARGIN,
};

export const calculateEstimateFromRules = (input: PricingInput) =>
  calculateEstimateFromRulesBase(input, DEFAULT_PUBLIC_QUOTE_CONFIG);
