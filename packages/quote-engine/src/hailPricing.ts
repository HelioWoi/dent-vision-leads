// =============================================================================
// Quote Engine — Hail Pricing
// Config-injectable: no calls to adminService or DB.
// =============================================================================

import { HailPricingRule, HailAnalysisResult, HailPanelAnalysis, QuoteEngineConfig } from './types';

// ─── Default Hail Pricing (Pickles Car Australia market rates + 35% margin) ──

export const DEFAULT_HAIL_PRICING_RULES: HailPricingRule[] = [
  { category: 'light',    dentRange: '1-50',   sizeCategory: 'up_to_25mm',    basePrice: 590,  aluminumMultiplier: 1.3 },
  { category: 'moderate', dentRange: '51-200',  sizeCategory: 'up_to_25mm',    basePrice: 1620, aluminumMultiplier: 1.3 },
  { category: 'severe',   dentRange: '201-500', sizeCategory: 'up_to_25mm',    basePrice: 3100, aluminumMultiplier: 1.3 },
  { category: 'extreme',  dentRange: '500+',    sizeCategory: 'up_to_25mm',    basePrice: 4500, aluminumMultiplier: 1.3 },
  { category: 'light',    dentRange: '1-50',   sizeCategory: 'oversize_25mm', basePrice: 890,  aluminumMultiplier: 1.3 },
  { category: 'moderate', dentRange: '51-200',  sizeCategory: 'oversize_25mm', basePrice: 2830, aluminumMultiplier: 1.3 },
  { category: 'severe',   dentRange: '201-500', sizeCategory: 'oversize_25mm', basePrice: 5120, aluminumMultiplier: 1.3 },
  { category: 'extreme',  dentRange: '500+',    sizeCategory: 'oversize_25mm', basePrice: 7000, aluminumMultiplier: 1.3 },
];

export const DEFAULT_HAIL_MARGIN = 35;

// ─── Severity Classification ──────────────────────────────────────────────────

export const categorizeHailSeverity = (
  dentCount: number
): 'light' | 'moderate' | 'severe' | 'extreme' => {
  if (dentCount <= 50)  return 'light';
  if (dentCount <= 200) return 'moderate';
  if (dentCount <= 500) return 'severe';
  return 'extreme';
};

// ─── Rule Matching ────────────────────────────────────────────────────────────

export const matchDentCountToRule = (
  dentCount: number,
  rules: HailPricingRule[],
  sizeCategory: 'up_to_25mm' | 'oversize_25mm'
): HailPricingRule | null => {
  const matchingRules = rules.filter(r => r.sizeCategory === sizeCategory);

  for (const rule of matchingRules) {
    const range = rule.dentRange;
    if (range.includes('+')) {
      const minDents = parseInt(range.replace('+', ''));
      if (dentCount >= minDents) return rule;
    } else if (range.includes('-')) {
      const [min, max] = range.split('-').map(s => parseInt(s));
      if (dentCount >= min && dentCount <= max) return rule;
    }
  }

  return null;
};

// ─── Single Panel Price ───────────────────────────────────────────────────────

export const calculatePanelHailPrice = (
  dentCount: number,
  sizeCategory: 'up_to_25mm' | 'oversize_25mm',
  isAluminum: boolean,
  config: Pick<QuoteEngineConfig, 'hailPricingRules' | 'hailPricingMargin'>
): { min: number; max: number } => {
  const rules = config.hailPricingRules?.length > 0
    ? config.hailPricingRules
    : DEFAULT_HAIL_PRICING_RULES;
  const margin = config.hailPricingMargin ?? DEFAULT_HAIL_MARGIN;

  let rule = matchDentCountToRule(dentCount, rules, sizeCategory);

  if (!rule) {
    const severity = categorizeHailSeverity(dentCount);
    rule = rules.find(r => r.category === severity && r.sizeCategory === sizeCategory)
      ?? DEFAULT_HAIL_PRICING_RULES.find(r => r.category === severity && r.sizeCategory === sizeCategory)!;
  }

  const basePrice = rule.basePrice;
  const priceWithMargin = Math.round(basePrice * (1 + margin / 100));
  const finalPrice = isAluminum
    ? Math.round(priceWithMargin * rule.aluminumMultiplier)
    : priceWithMargin;

  return { min: finalPrice, max: finalPrice };
};

// ─── Multi-Panel Total Estimate ───────────────────────────────────────────────

export const calculateTotalHailEstimate = (
  panels: Array<{
    panel_name: string;
    dent_count: number;
    size_category: 'up_to_25mm' | 'oversize_25mm';
    is_aluminum: boolean;
  }>,
  config: Pick<QuoteEngineConfig, 'hailPricingRules' | 'hailPricingMargin'>
): HailAnalysisResult => {
  const panelAnalyses: HailPanelAnalysis[] = [];
  let totalMin = 0;
  let totalMax = 0;
  let totalDents = 0;

  for (const panel of panels) {
    const severity = categorizeHailSeverity(panel.dent_count);
    const cost = calculatePanelHailPrice(
      panel.dent_count,
      panel.size_category,
      panel.is_aluminum,
      config
    );

    panelAnalyses.push({
      panel_name: panel.panel_name,
      dent_count: panel.dent_count,
      severity,
      size_category: panel.size_category,
      estimated_cost: cost,
    });

    totalMin += cost.min;
    totalMax += cost.max;
    totalDents += panel.dent_count;
  }

  return {
    panels: panelAnalyses,
    total_dents: totalDents,
    overall_severity: categorizeHailSeverity(totalDents),
    vehicle_type: '',
    material: '',
    estimated_total_cost: { min: totalMin, max: totalMax },
    confidence: 0.85,
    notes: 'Preliminary hail damage estimate. Final price will be confirmed by technician after detailed inspection.',
  };
};

// ─── Display Helpers ──────────────────────────────────────────────────────────

export const getSeverityInfo = (severity: 'light' | 'moderate' | 'severe' | 'extreme') => {
  const severityMap = {
    light:    { emoji: '🟢', label: 'Light',    description: '1-50 dents - Standard PDR',              color: 'text-green-600',  bgColor: 'bg-green-100'  },
    moderate: { emoji: '🟡', label: 'Moderate', description: '51-200 dents - Extensive PDR',            color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    severe:   { emoji: '🟠', label: 'Severe',   description: '201-500 dents - PDR + possible paint',    color: 'text-orange-600', bgColor: 'bg-orange-100' },
    extreme:  { emoji: '🔴', label: 'Extreme',  description: '500+ dents - Panel replacement may be required', color: 'text-red-600', bgColor: 'bg-red-100' },
  };
  return severityMap[severity];
};

export const formatHailPrice = (min: number, max: number): string =>
  `$${min.toLocaleString()} - $${max.toLocaleString()}`;
