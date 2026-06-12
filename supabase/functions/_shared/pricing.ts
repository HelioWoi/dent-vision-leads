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

/** Reference panel dimensions (mm) for %→mm conversion when no ruler is visible. */
export const PANEL_REFERENCE_MM: Readonly<Record<string, { height: number; width: number }>> = {
  front_door: { height: 850, width: 700 },
  rear_door: { height: 850, width: 700 },
  door: { height: 850, width: 700 },
  bonnet: { height: 600, width: 1400 },
  boot_lid: { height: 500, width: 1200 },
  front_quarter_panel: { height: 600, width: 700 },
  rear_quarter_panel: { height: 600, width: 700 },
  guard: { height: 600, width: 700 },
  roof: { height: 400, width: 1400 },
  front_bumper: { height: 400, width: 1600 },
  rear_bumper: { height: 400, width: 1600 },
};

export const normalizePanelKey = (panel?: string): string => {
  const p = String(panel || '').toLowerCase().replace(/\s+/g, '_');
  if (/front_door/.test(p)) return 'front_door';
  if (/rear_door/.test(p)) return 'rear_door';
  if (/door/.test(p)) return 'door';
  if (/boot|trunk|tailgate|hatch/.test(p)) return 'boot_lid';
  if (/bonnet|hood/.test(p)) return 'bonnet';
  if (/quarter|fender/.test(p)) return /rear/.test(p) ? 'rear_quarter_panel' : 'front_quarter_panel';
  if (/guard/.test(p)) return 'guard';
  if (/bumper/.test(p)) return /rear/.test(p) ? 'rear_bumper' : 'front_bumper';
  if (/roof/.test(p)) return 'roof';
  return p || 'door';
};

/** Converts AI panel-height/width % estimates into mm span (uses larger axis). */
export const damageSpanMmFromPanelPct = (
  panel?: string,
  heightPct?: number,
  widthPct?: number,
): number => {
  const ref = PANEL_REFERENCE_MM[normalizePanelKey(panel)] || PANEL_REFERENCE_MM.door;
  const hMm = (heightPct || 0) > 0 ? (heightPct! / 100) * ref.height : 0;
  const wMm = (widthPct || 0) > 0 ? (widthPct! / 100) * ref.width : 0;
  return Math.round(Math.max(hMm, wMm));
};

export const isDoorPanel = (panel?: string): boolean =>
  /door/.test(normalizePanelKey(panel));

export const isVerticalDoorCrease = (input: {
  panelDetected?: string;
  creaseOrientation?: string;
  dentType?: string;
  damageHeightPct?: number;
  damageWidthPct?: number;
}): boolean => {
  if (!isDoorPanel(input.panelDetected)) return false;
  const orient = String(input.creaseOrientation || '').toLowerCase();
  if (orient === 'vertical') return true;
  const h = input.damageHeightPct || 0;
  const w = input.damageWidthPct || 0;
  if (h >= 15 && h > w * 1.4) return true;
  return /crease|bodyline/.test(String(input.dentType || '').toLowerCase()) && h >= 12 && h > w;
};

/**
 * Panel-relative category floor — more reliable than AI mm guess for large creases.
 * Silver door vertical crease (~30–50% door height) → Category 7.
 */
export const categoryFromPanelDamage = (input: {
  panelDetected?: string;
  damageHeightPct?: number;
  damageWidthPct?: number;
  creaseOrientation?: string;
  dentType?: string;
  geometryScore?: number;
  stressScore?: number;
}): number => {
  const panel = normalizePanelKey(input.panelDetected);
  const hPct = input.damageHeightPct || 0;
  const wPct = input.damageWidthPct || 0;
  const dentType = String(input.dentType || '').toLowerCase();
  const isCrease = /crease|bodyline|collapsed/.test(dentType);
  const verticalDoor = isVerticalDoorCrease(input);

  if (verticalDoor) {
    // User-calibrated: full-height / major vertical door crease = Cat 7
    if (hPct >= 28 || (hPct >= 22 && (input.geometryScore || 0) >= 4)) return 7;
    if (hPct >= 18) return 6;
    if (hPct >= 12) return 5;
  }

  if (isDoorPanel(panel) && isCrease && hPct >= 25) {
    return hPct >= 35 ? 7 : 6;
  }

  const spanMm = damageSpanMmFromPanelPct(panel, hPct, wPct);
  if (spanMm > 0) return categoryBySizeMm(spanMm);
  return 0;
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
  panelDetected?: string;
  damageHeightPct?: number;
  damageWidthPct?: number;
  creaseOrientation?: string;
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

  // Deep/medium ding mislabeled as Cat 1 when scores indicate 31–60mm deformation.
  if (
    cat === 1 &&
    (s.sizeScore || 0) >= 2 &&
    (s.geometryScore || 0) >= 2
  ) {
    cat = 2;
    reasons.push('deep_ding_scores→floor_cat2');
  }

  // Visible medium dent mislabeled Cat 1 when location/geometry indicate clear deformation.
  if (
    cat === 1 &&
    (s.locationScore || 0) >= 3 &&
    (s.geometryScore || 0) >= 2
  ) {
    cat = 2;
    reasons.push('visible_panel_dent→floor_cat2');
  }

  // Deep/sharp dent mislabeled Cat 2 when scores indicate 61–90mm deformation.
  if (
    cat === 2 &&
    (s.sizeScore || 0) >= 3
  ) {
    cat = 3;
    reasons.push('deep_dent_size_score→floor_cat3');
  }

  if (
    cat === 2 &&
    (s.stressScore || 0) >= 2 &&
    (s.geometryScore || 0) >= 2 &&
    (s.locationScore || 0) >= 3
  ) {
    cat = 3;
    reasons.push('deep_sharp_near_bodyline→floor_cat3');
  }

  if (cat === 2 && (s.locationScore || 0) >= 4) {
    cat = 3;
    reasons.push('deep_arch_or_edge→floor_cat3');
  }

  if (
    cat === 2 &&
    (s.locationScore || 0) >= 3 &&
    (s.sizeScore || 0) >= 2 &&
    (s.geometryScore || 0) >= 2
  ) {
    cat = 3;
    reasons.push('large_bowl_near_edge→floor_cat3');
  }

  // Large crease/dent mislabeled Cat 3 when scores indicate 91–160mm deformation.
  if (
    cat === 3 &&
    (s.sizeScore || 0) >= 3 &&
    (s.stressScore || 0) >= 3 &&
    (s.geometryScore || 0) >= 3
  ) {
    cat = 4;
    reasons.push('large_crease_scores→floor_cat4');
  }

  if (
    cat <= 3 &&
    (s.sizeScore || 0) >= 3 &&
    (s.stressScore || 0) >= 4 &&
    (s.geometryScore || 0) >= 4
  ) {
    cat = 4;
    reasons.push('sharp_long_crease→floor_cat4');
  }

  // Major crease mislabeled Cat 4 when scores indicate 161–260mm deformation.
  if (
    cat === 4 &&
    (s.sizeScore || 0) >= 4
  ) {
    cat = 5;
    reasons.push('major_crease_size_score→floor_cat5');
  }

  if (
    cat <= 4 &&
    (s.sizeScore || 0) >= 4 &&
    (s.stressScore || 0) >= 3 &&
    (s.geometryScore || 0) >= 4
  ) {
    cat = 5;
    reasons.push('major_crease_scores→floor_cat5');
  }

  const dentType = String(s.dentType || '').toLowerCase();
  const verticalDoorCrease = isVerticalDoorCrease({
    panelDetected: s.panelDetected,
    creaseOrientation: s.creaseOrientation,
    dentType: s.dentType,
    damageHeightPct: s.damageHeightPct,
    damageWidthPct: s.damageWidthPct,
  });

  // Panel-relative sizing — primary guardrail for large vertical door creases (Cat 7).
  const panelCat = categoryFromPanelDamage({
    panelDetected: s.panelDetected,
    damageHeightPct: s.damageHeightPct,
    damageWidthPct: s.damageWidthPct,
    creaseOrientation: s.creaseOrientation,
    dentType: s.dentType,
    geometryScore: s.geometryScore,
    stressScore: s.stressScore,
  });
  if (panelCat > cat) {
    cat = panelCat;
    reasons.push(`panel_pct→floor_cat${panelCat}`);
  }

  // Hard rule: vertical door crease with clear geometry/stress → never below Cat 7 when tall enough.
  if (
    verticalDoorCrease &&
    (s.damageHeightPct || 0) >= 25 &&
    ((s.geometryScore || 0) >= 3 || (s.stressScore || 0) >= 3 || /crease|bodyline/.test(dentType))
  ) {
    if (cat < 7) {
      cat = 7;
      reasons.push('vertical_door_crease→floor_cat7');
    }
  }

  if (
    cat <= 5 &&
    (s.sizeScore || 0) >= 4 &&
    (s.stressScore || 0) >= 4 &&
    (s.geometryScore || 0) >= 5
  ) {
    cat = 6;
    reasons.push('severe_bodyline_collapse→floor_cat6');
  }

  if (
    cat === 5 &&
    /bodyline|collapsed/.test(dentType) &&
    (s.stressScore || 0) >= 4 &&
    (s.geometryScore || 0) >= 4
  ) {
    cat = 6;
    reasons.push('complex_bodyline→floor_cat6');
  }

  if (cat <= 6 && (s.sizeScore || 0) >= 5) {
    cat = 7;
    reasons.push('massive_deformation→floor_cat7');
  }

  if (cat <= 6 && /bumper/.test(dentType) && (s.sizeScore || 0) >= 4) {
    cat = 7;
    reasons.push('massive_bumper→floor_cat7');
  }

  if (
    cat === 6 &&
    (s.geometryScore || 0) >= 5 &&
    (s.stressScore || 0) >= 4
  ) {
    cat = 7;
    reasons.push('full_panel_crease→floor_cat7');
  }

  const isHighRiskType = /bodyline|crease|collapsed|collision/.test(dentType);
  const aiCategorySet = !!(s.aiCategory && s.aiCategory >= 1);
  const smallLocalized =
    (s.sizeScore || 0) <= 2 &&
    (s.stressScore || 0) <= 2 &&
    (s.geometryScore || 0) <= 2;

  // Shallow crease / elongated ding mislabeled as crease_dent — cap at Category 2.
  // Never cap vertical door creases spanning significant panel height.
  if (/crease/.test(dentType) && smallLocalized && cat > 2 && !verticalDoorCrease) {
    cat = 2;
    reasons.push('small_crease_mislabel→cap_cat2');
  }

  const panelSpanMm = damageSpanMmFromPanelPct(
    s.panelDetected,
    s.damageHeightPct,
    s.damageWidthPct,
  );
  const effectiveSizeMm = Math.max(s.sizeMm || 0, panelSpanMm);

  if (effectiveSizeMm > 0) {
    const bySize = categoryBySizeMm(effectiveSizeMm);
    if (bySize > cat) {
      cat = bySize;
      reasons.push(`size_mm=${effectiveSizeMm}→cat${bySize}`);
    }
  }

  const score = Math.min(5, Math.max(0, Math.round(s.sizeScore || 0)));
  const byScore = SIZE_SCORE_CATEGORY_FLOOR[score] || 0;
  if (byScore > cat) {
    cat = byScore;
    reasons.push(`size_score=${score}→floor_cat${byScore}`);
  }

  // Bodyline/crease guardrails — skip only when AI already placed damage at Cat 6–7.
  const skipHighRiskFloors = aiCategorySet && s.aiCategory! >= 6;

  if (!skipHighRiskFloors) {
    if (/bodyline/.test(dentType) && (s.sizeScore || 0) >= 4 && cat < 7) {
      cat = 7;
      reasons.push(`bodyline_dent+size_score≥4→floor_cat7`);
    } else if (/bodyline/.test(dentType) && (s.sizeScore || 0) >= 4 && cat < 5) {
      cat = 5;
      reasons.push(`bodyline_dent+size_score≥4→floor_cat5`);
    } else if (
      /crease/.test(dentType) &&
      (s.sizeScore || 0) >= 4 &&
      (s.stressScore || 0) >= 3 &&
      cat < 7
    ) {
      cat = 7;
      reasons.push(`crease_dent+large→floor_cat7`);
    } else if (/crease/.test(dentType) && (s.sizeScore || 0) >= 4 && (s.stressScore || 0) >= 3 && cat < 5) {
      cat = 5;
      reasons.push(`crease_dent+moderate→floor_cat5`);
    }
  }

  if (/collapsed|collision/.test(dentType) && cat < 6) {
    cat = 6;
    reasons.push(`dent_type=${dentType}→floor_cat6`);
  }

  // Fallback when AI omits panel % but scores/type indicate major vertical door crease.
  if (
    isDoorPanel(s.panelDetected) &&
    /crease|bodyline/.test(dentType) &&
    (s.geometryScore || 0) >= 4 &&
    (s.stressScore || 0) >= 3 &&
    cat < 7
  ) {
    cat = 7;
    reasons.push('door_crease_scores→floor_cat7');
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
