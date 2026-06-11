// ============================================================================
// CANONICAL PDR CATEGORY PRICING — SINGLE SOURCE OF TRUTH
//
// Consumed by BOTH sides of the app:
//   - Edge functions:  analyze-dents-secure, analyze-live-scan
//   - Frontend:        components/PublicEstimate/* (via direct import)
//
// NOTE: packages/quote-engine/src/pricing.ts DEFAULT_PDR_PRICING_RULES mirrors
// these base prices for the live-scan orchestrator path. If you change the
// table below, update it there too (values must stay identical).
//
// Prices are AUD with the 22% margin already included:
//   priceMin = base price, priceMax = base × 1.22 (rounded).
//
// PRICING POLICY: AI dent_category is the primary signal. Code floors only apply
// for explicit bodyline/crease/collapse types — not for soft_dent where AI already
// sized the job. Shops approve every estimate before final pricing.
// ============================================================================

export interface CategoryPricing {
  category: number;
  range: string;
  minMm: number;
  maxMm: number;
  priceMin: number;
  priceMax: number;
}

export const PDR_MARGIN_PCT = 22;

export const PRICING_TABLE: readonly CategoryPricing[] = [
  { category: 1, range: '0-30mm',    minMm:   0, maxMm:  30, priceMin: 118, priceMax: 144 },
  { category: 2, range: '31-60mm',   minMm:  31, maxMm:  60, priceMin: 180, priceMax: 220 },
  { category: 3, range: '61-90mm',   minMm:  61, maxMm:  90, priceMin: 258, priceMax: 315 },
  { category: 4, range: '91-160mm',  minMm:  91, maxMm: 160, priceMin: 293, priceMax: 357 },
  { category: 5, range: '161-260mm', minMm: 161, maxMm: 260, priceMin: 392, priceMax: 478 },
  { category: 6, range: '261-400mm', minMm: 261, maxMm: 400, priceMin: 490, priceMax: 598 },
  { category: 7, range: '400-600mm', minMm: 401, maxMm: 600, priceMin: 680, priceMax: 830 },
] as const;

/** Honest "no price" marker: analysis failed or is unreliable. UI must route to inspection instead of showing a number. */
export const NO_PRICE = { min: 0, max: 0 } as const;

export const clampCategory = (cat: number): number =>
  Math.min(7, Math.max(1, Math.round(cat || 1)));

export const pricingByCategory = (cat: number): CategoryPricing =>
  PRICING_TABLE[clampCategory(cat) - 1];

export const categoryBySizeMm = (sizeMm: number): number => {
  if (!(sizeMm > 0)) return 1;
  for (const r of PRICING_TABLE) {
    if (sizeMm <= r.maxMm) return r.category;
  }
  return 7;
};

/** Midpoint of a category's size band, in mm (for display/marker purposes). */
export const categoryMidpointMm = (cat: number): number => {
  const e = pricingByCategory(cat);
  return Math.round((e.minMm + e.maxMm) / 2);
};

/** Parses prompt-format size ranges like "261-400mm" → upper bound in mm (up-bias). Returns 0 when unparseable. */
export const parseSizeRangeUpperMm = (range?: string): number => {
  if (!range) return 0;
  const m = String(range).match(/(\d+)\s*-\s*(\d+)\s*mm/i);
  if (!m) return 0;
  return parseInt(m[2], 10) || 0;
};

export interface CategorySignals {
  aiCategory?: number;
  sizeMm?: number;
  sizeScore?: number;      // 1=<30mm 2=31-60 3=61-160 4=161-400 5=>400 (per analysis prompt)
  stressScore?: number;    // 1-5
  geometryScore?: number;  // 1-5
  locationScore?: number;  // 1-5 (4=handle/bodyline, 5=extreme edge)
  dentType?: string;       // crease_dent | bodyline_dent | collapsed_dent | ...
  severity?: string;       // minor | moderate | medium | severe
  triageDamageDetected?: boolean;
  /** @deprecated Ellipse marks location only — never used for pricing floors. */
  userRegionCategory?: number;
}

/** @deprecated User ellipses indicate WHERE to look, not dent size. Kept for telemetry only. */
export const categoryFromUserPolygons = (polygons: [number, number][][]): number => {
  if (!polygons?.length) return 0;
  let cat = 0;
  for (const poly of polygons) {
    if (!poly?.length) continue;
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    const spanPct = Math.max(
      (Math.max(...xs) - Math.min(...xs)) * 100,
      (Math.max(...ys) - Math.min(...ys)) * 100,
    );
    let regionCat = 1;
    if (spanPct >= 45) regionCat = 7;
    else if (spanPct >= 35) regionCat = 6;
    else if (spanPct >= 22) regionCat = 5;
    else if (spanPct >= 14) regionCat = 4;
    else if (spanPct >= 8) regionCat = 3;
    else if (spanPct >= 4) regionCat = 2;
    cat = Math.max(cat, regionCat);
  }
  return cat;
};

// size_score band → minimum category (aligned to prompt bands, not up-biased).
// score: 0(none) 1(<30mm) 2(31-60) 3(61-160) 4(161-400) 5(>400)
const SIZE_SCORE_CATEGORY_FLOOR = [0, 1, 2, 3, 5, 7] as const;

/**
 * Resolves dent category from AI signals + conservative guardrail floors.
 * AI dent_category is the primary signal; floors only catch clear under-quotes
 * (e.g. confirmed bodyline crease with large deformation).
 */
export const resolveCategory = (s: CategorySignals): { category: number; reasons: string[] } => {
  const reasons: string[] = [];
  let cat = 0;

  if (s.aiCategory && s.aiCategory >= 1) {
    cat = clampCategory(s.aiCategory);
    reasons.push(`ai_category=${cat}`);
  }

  const dentType = String(s.dentType || '').toLowerCase();
  const isHighRiskType = /bodyline|crease|collapsed|collision/.test(dentType);
  const aiCategorySet = !!(s.aiCategory && s.aiCategory >= 1);

  if (s.sizeMm && s.sizeMm > 0) {
    const bySize = categoryBySizeMm(s.sizeMm);
    if (bySize > cat && (!aiCategorySet || isHighRiskType)) {
      cat = bySize;
      reasons.push(`size_mm=${s.sizeMm}→cat${bySize}`);
    }
  }

  const score = Math.min(5, Math.max(0, Math.round(s.sizeScore || 0)));
  const byScore = SIZE_SCORE_CATEGORY_FLOOR[score] || 0;
  if (byScore > cat && (!aiCategorySet || isHighRiskType)) {
    cat = byScore;
    reasons.push(`size_score=${score}→floor_cat${byScore}`);
  }

  // Bodyline/crease guardrails — only when AI explicitly classified as such.
  if (/bodyline/.test(dentType) && (s.sizeScore || 0) >= 4 && cat < 7) {
    cat = 7;
    reasons.push(`bodyline_dent+size_score≥4→floor_cat7`);
  } else if (/bodyline/.test(dentType) && (s.sizeScore || 0) >= 3 && cat < 5) {
    cat = 5;
    reasons.push(`bodyline_dent+size_score≥3→floor_cat5`);
  } else if (
    /crease/.test(dentType) &&
    (s.sizeScore || 0) >= 4 &&
    (s.stressScore || 0) >= 3 &&
    cat < 7
  ) {
    cat = 7;
    reasons.push(`crease_dent+large→floor_cat7`);
  } else if (/crease/.test(dentType) && (s.sizeScore || 0) >= 3 && (s.stressScore || 0) >= 3 && cat < 5) {
    cat = 5;
    reasons.push(`crease_dent+moderate→floor_cat5`);
  }

  if (/collapsed|collision/.test(dentType) && cat < 6) {
    cat = 6;
    reasons.push(`dent_type=${dentType}→floor_cat6`);
  }

  return { category: clampCategory(cat || 1), reasons };
};

/** Progressive multi-dent pricing (same rule as quote-engine): 1st 100%, 2nd +80%, 3rd+ +60% each. */
export const progressiveDentMultiplier = (dentCount: number): number => {
  const n = Math.max(1, Math.round(dentCount || 1));
  if (n === 1) return 1;
  return 1 + 0.8 + 0.6 * (n - 2);
};

/** Final price for a category and dent count — the ONLY way a price should be produced. */
export const priceForCategory = (category: number, dentCount = 1): { min: number; max: number } => {
  const e = pricingByCategory(category);
  const m = progressiveDentMultiplier(dentCount);
  return { min: Math.round(e.priceMin * m), max: Math.round(e.priceMax * m) };
};
