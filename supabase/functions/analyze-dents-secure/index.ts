import { corsHeaders, fail, ok } from '../_shared/response.ts';
import { generateGeminiJson } from '../_shared/gemini.ts';
import { generateOpenAIVisionJson, isOpenAIConfigured } from '../_shared/openai.ts';
import { isNonVehicleSubject, isVehicleImageAccepted } from '../_shared/imageValidation.ts';
import {
  NO_PRICE,
  categoryBySizeMm,
  categoryMidpointMm,
  parseSizeRangeUpperMm,
  priceForCategory,
  pricingByCategory,
  resolveCategory,
} from '../_shared/pricing.ts';

// ─── Step 1: Gemini Flash triage — fast, cheap, determines image usability ────

const GEMINI_TRIAGE_PROMPT = [
  'You are a fast image triage agent for a PDR (Paintless Dent Repair) automotive system.',
  'Quickly assess whether this image shows a vehicle exterior suitable for dent analysis.',
  'Return ONLY valid JSON, no extra text:',
  '{"valid_image":boolean,"image_is_vehicle":boolean,"image_quality":"good|acceptable|poor|unusable","damage_detected":boolean,"panel_detected":"panel name","detected_subject":"brief description","needs_better_image":boolean,"better_image_reason":null}',
  'Rules:',
  '- valid_image=true if the image shows any exterior part of a vehicle, even a close-up panel with a dent.',
  '- image_is_vehicle=true for close-up shots of panels, dents, bodywork, or paint.',
  '- damage_detected=true if any dents, creases, scratches, or deformation are visible.',
  '- needs_better_image=true ONLY if the image is too dark, too blurry, or the angle prevents damage assessment.',
  '- Set detected_subject to a short description of exactly what you see.',
  '',
  'PANEL IDENTIFICATION — set panel_detected to one of these exact values:',
  '"boot_lid" — rear hatch/trunk panel. Indicators: license plate, reverse lights, rear badge, tailgate handle, rear wiper, curved rear edges, rubber seal at top, rear glass/screen visible above.',
  '"bonnet" — front engine cover. Indicators: front grille visible, headlight edges, flat large panel at front.',
  '"front_door" — driver or passenger front door. Indicators: door handle at mid-height, side mirror at front edge, window glass above.',
  '"rear_door" — rear passenger door. Indicators: door handle, no side mirror, rear door seam.',
  '"front_bumper" — plastic bumper at front. Indicators: headlights, grille, tow hook area.',
  '"rear_bumper" — plastic bumper at rear. Indicators: tail lights, exhaust tips, reversing sensor holes.',
  '"front_quarter_panel" — panel between front wheel arch and front door.',
  '"rear_quarter_panel" — panel between rear door and rear wheel arch, behind C-pillar.',
  '"roof" — top of vehicle, viewed from above or side.',
  '"sill" — lower rocker panel below doors.',
  '"unknown" — only if panel cannot be identified at all.',
  'IMPORTANT: If you see a large flat panel at the rear of the vehicle with rubber seals, it is the boot_lid, NOT a door.',
].join('\n');

// ─── Step 2: OpenAI Vision deep analysis — scoring, classification, reasoning ─

const OPENAI_DEEP_ANALYSIS_PROMPT = [
  'You are an expert PDR (Paintless Dent Repair) damage analysis system for pre-estimation.',
  'FIRST: set valid_image=false and image_is_vehicle=false for screenshots, UI, dashboards, spreadsheets, documents, websites, or any non-vehicle image.',
  'If valid_image=false, set damage_detected=false, dent_count=0, suggested_base_price=0.',
  'Analyze the provided vehicle damage image(s) and return a detailed structured assessment.',
  '',
  'PANEL IDENTIFICATION — set panel_detected to one of:',
  '"boot_lid" — rear hatch/trunk. Signs: license plate, reverse lights, rear badge, tailgate handle, rear wiper, curved rear edges, rubber boot seal, rear glass above panel.',
  '"bonnet" — front engine cover. Signs: front grille, headlight edges visible.',
  '"front_door" — Signs: door handle at mid-height, side mirror at leading edge, side window glass above.',
  '"rear_door" — Signs: door handle, no side mirror, rear door seam visible.',
  '"front_bumper" or "rear_bumper" — plastic bumper panels.',
  '"front_quarter_panel" or "rear_quarter_panel" — metal panel between door and wheel arch.',
  '"roof" — top surface, sill, or unknown.',
  'CRITICAL: If you see a large flat panel at the rear of the vehicle with a rubber seal at the top edge or reverse lights nearby — it is "boot_lid", NOT a door.',
  '',
  'DAMAGE CATEGORIES — use these EXACT base prices (AUD, 22% margin included):',
  'Category 1: 0–30mm    → base $118 → range $118–$144',
  'Category 2: 31–60mm   → base $180 → range $180–$220',
  'Category 3: 61–90mm   → base $258 → range $258–$315',
  'Category 4: 91–160mm  → base $293 → range $293–$357',
  'Category 5: 161–260mm → base $392 → range $392–$478',
  'Category 6: 261–400mm → base $490 → range $490–$598',
  'Category 7: 400–600mm → base $680 → range $680–$830',
  '',
  'SIZE ESTIMATION — AREA-BASED RULES (use when no reference object is visible):',
  'Reference sizes: door handle ~180mm, fuel cap ~165mm, wheel ~450mm, boot lid ~500mm wide, car door ~850mm tall.',
  'Area proportion method (when references not visible):',
  '- Deformation covers >50% of the visible panel area → minimum Category 6 (261–400mm)',
  '- Deformation covers 25–50% of visible panel area → minimum Category 4 (91–160mm)',
  '- Deformation covers 10–25% of visible panel area → minimum Category 3 (61–90mm)',
  '- Deformation covers <10% of visible panel area → Category 1–2',
  'Stress line rule: if you see 2+ stress crease lines spanning most of the panel → minimum Category 5.',
  'Boot/trunk rule: a crease or collapse covering most of the boot lid → minimum Category 6.',
  'SMALL BODYLINE DENT (common): a shallow nick or small crease sitting ON a body line but under 30mm with localized reflection pinch → Category 1, dent_type=soft_dent or sharp_dent (NOT bodyline_dent).',
  'Use dent_type=bodyline_dent ONLY when the crease significantly deforms the body line over >90mm with clear metal stress.',
  'Do NOT treat broad reflection highlights or panel curvature as deformation area.',
  'Measure the actual crease/dent length — not the full distorted reflection zone.',
  '',
  'CLASSIFICATION FACTORS:',
  '- Reflection distortion: subtle=shallow, strong/wavy=deep deformation',
  '- Metal stress: creases, sharp edges, collapsed metal',
  '- Dent geometry: round, irregular, linear crease, complex crease pattern',
  '- Panel location: center flat, near bodyline, near wheel arch, edge',
  '- Edge or bodyline involvement',
  '- Paint damage indicators (cracks, chips, exposed primer)',
  '',
  'DENT TYPES: soft_dent | sharp_dent | crease_dent | collapsed_dent | bodyline_dent | edge_dent | bumper_damage | collision_like',
  '',
  'BODYLINE / CREASE RULES:',
  '- Small shallow dent on a body line (<30mm, localized pinch) → Category 1–2, dent_type=soft_dent or sharp_dent.',
  '- A crease ON or ACROSS a body line with clear metal stress over >90mm → dent_type="bodyline_dent", minimum Category 5.',
  '- A vertical or diagonal sharp crease with visible metal stress/warping over >90mm → dent_type="crease_dent", minimum Category 5.',
  '- Collapsed or heavily stretched metal → dent_type="collapsed_dent", minimum Category 6.',
  '- If the deformation distorts reflections across a large area of the door panel → size_score >= 4.',
  '- Door handle visible and dent wraps around or through it → location_score >= 4.',
  '',
  'SCORING (1–5 each):',
  'size_score: 1=tiny(<30mm) 2=small(31-60mm) 3=medium(61-160mm) 4=large(161-400mm) 5=massive(>400mm)',
  'stress_score: 1=soft(no stress lines) 2=light 3=moderate crease 4=sharp/multiple creases 5=collapsed/heavy stress',
  'geometry_score: 1=simple round 2=oval 3=irregular 4=linear crease 5=complex multi-crease pattern',
  'location_score: 1=flat panel center 2=open area 3=near bodyline 4=near handle/edge 5=wheel arch/extreme edge',
  'access_score: 1=easy flat panel 2=standard 3=moderate restriction 4=near trim/edge 5=very restricted',
  '',
  'PDR SUITABILITY: excellent | good | fair | poor | not_pdr',
  '- not_pdr if: paint cracked/off, structural damage suspected, bumper collapse',
  '- poor if: paint at risk, very deep crease, heavy metal stress',
  '',
  'PRICING GUIDANCE:',
  '- Use the category base price as suggested_base_price',
  '- Raise up to 15% above range max if stress_score + geometry_score >= 7',
  '- Do NOT go below category base price',
  '- bodyshop_approval_required is always true — AI is pre-estimate only',
  '- estimated_min = category base price, estimated_max = category range max',
  '- Size from actual metal deformation length, not reflection spread or user ellipse size.',
  '',
  'IMPORTANT:',
  '- If no damage visible, set damage_detected=false and suggested_base_price=0',
  '- If collision/structural damage suspected, set manual_review_recommended=true',
  '- Count dents conservatively; do not double-count across angles',
  '',
  'Return ONLY valid JSON, no extra text:',
  '{"valid_image":boolean,"image_is_vehicle":boolean,"image_quality":"good|acceptable|poor|unusable","damage_detected":boolean,"panel_detected":string,"dent_count":number,"scratch_count":number,"dent_category":number,"dent_size_range":string,"dent_type":string,"severity":"minor|medium|severe","estimated_min":number,"estimated_max":number,"size_score":number,"stress_score":number,"geometry_score":number,"location_score":number,"access_score":number,"pdr_suitability":"excellent|good|fair|poor|not_pdr","manual_review_recommended":boolean,"bodyshop_approval_required":true,"suggested_base_price":number,"confidence":number,"notes":string,"reason":string}',
].join('\n');

// ─── Gemini fallback analysis (used when OpenAI is unavailable) ───────────────

const GEMINI_DENT_ANALYSIS_PROMPT = [
  'You are an expert automotive dent analysis assistant for PDR pre-estimation.',
  'FIRST: set valid_image=false and image_is_vehicle=false for screenshots, UI, dashboards, spreadsheets, documents, websites, or any non-vehicle image.',
  'If valid_image=false, set damage_detected=false, dent_count=0, suggested_base_price=0.',
  'Analyze ONLY exterior vehicle body-panel damage from all provided photos together.',
  'If the same dent appears in multiple photos/angles, count it once (no double counting).',
  '',
  'SIZE ESTIMATION RULES:',
  'Reference sizes when visible: door handle ~180mm, fuel cap ~165mm, wheel ~450mm, boot lid ~500mm wide, car door ~850mm tall.',
  'When no reference object is visible, use area proportion:',
  '- Deformation >50% of visible panel → size_cm >= 30 (Category 6+)',
  '- Deformation 25-50% of visible panel → size_cm 10-30 (Category 4-5)',
  '- Deformation 10-25% of visible panel → size_cm 6-10 (Category 3)',
  '- Multiple stress crease lines spanning the panel → size_cm >= 20',
  'NEVER set size_cm=1 or 2 for damage that clearly covers a broad area of the panel.',
  'When in doubt, choose the LARGER size estimate.',
  '',
  'Depth: Shallow=subtle reflection distortion | Medium=clear deformation | Deep=sharp crease/collapse.',
  'Severity: Minor=small/shallow/localized | Moderate=medium or multiple | Severe=large/deep/crease spanning panel.',
  '',
  'SMALL DENT ON BODY LINE: shallow nick <30mm on body line → size_cm 1-3, severity=Minor, Category 1.',
  'BODYLINE / CREASE (large only): dent on body line with stress over >90mm → size_cm >= 20, severity=Severe, dent_type=bodyline_dent.',
  'Vertical crease with stress lines → size_cm >= 25, depth=Deep.',
  'NEVER return dent_count=0 when clear deformation is visible.',
  '',
  'PRICING TABLE (AUD) — use these exact values for estimated_min/estimated_max:',
  '0-30mm: $118-$144 | 31-60mm: $180-$220 | 61-90mm: $258-$315',
  '91-160mm: $293-$357 | 161-260mm: $392-$478 | 261-400mm: $490-$598 | 400-600mm: $680-$830',
  'ALWAYS set estimated_min and estimated_max to non-zero values from the table above.',
  'Set scratch_count>0 if you see any paint transfer, scratch marks, or paint chips.',
  'Return ONLY strict JSON:',
  '{"dent_count":number,"scratch_count":number,"severity":"Minor|Moderate|Severe|Unknown","estimated_min":number,"estimated_max":number,"confidence":number,"notes":string,"dents":[{"size_cm":number,"depth":"Shallow|Medium|Deep","severity_score":number,"confidence":number,"polygon":[[x,y],[x,y],[x,y]]}]}',
].join('\n');

// ─── Types ────────────────────────────────────────────────────────────────────

type GeminiTriage = {
  valid_image?: boolean;
  image_is_vehicle?: boolean;
  image_quality?: string;
  damage_detected?: boolean;
  panel_detected?: string;
  detected_subject?: string;
  needs_better_image?: boolean;
  better_image_reason?: string | null;
};

type OpenAIAnalysis = {
  valid_image?: boolean;
  image_is_vehicle?: boolean;
  image_quality?: string;
  damage_detected?: boolean;
  panel_detected?: string;
  dent_count?: number;
  scratch_count?: number;
  dent_category?: number;
  dent_size_range?: string;
  dent_type?: string;
  severity?: string;
  estimated_min?: number;
  estimated_max?: number;
  size_score?: number;
  stress_score?: number;
  geometry_score?: number;
  location_score?: number;
  access_score?: number;
  pdr_suitability?: string;
  manual_review_recommended?: boolean;
  bodyshop_approval_required?: boolean;
  suggested_base_price?: number;
  confidence?: number;
  needs_paint_repair?: boolean;
  notes?: string;
  reason?: string;
};

type GeminiDentModel = {
  dent_count: number;
  scratch_count: number;
  severity: 'Minor' | 'Moderate' | 'Severe' | 'Unknown';
  estimated_min: number;
  estimated_max: number;
  confidence: number;
  notes?: string;
  dents?: Array<{
    size_cm: number;
    depth: 'Shallow' | 'Medium' | 'Deep';
    severity_score: number;
    confidence: number;
    polygon?: number[][];
  }>;
};

type AnalyzeDentsInput = {
  images?: string[];
  imageTypes?: string[];
  userPolygons?: [number, number][][];
  vehicleDetails?: { vehicleType?: string };
};

const USER_GUIDE_PREFIX = (polygons: [number, number][][]) =>
  polygons.length
    ? [
        '',
        'USER MARKED DAMAGE REGIONS (normalized 0–1 coordinates):',
        JSON.stringify(polygons),
        'The customer drew ellipses around WHERE the damage is — location guide only.',
        'Analyze the marked region(s) for dent count, type, and category.',
        'IMPORTANT: ellipse size ≠ dent size. Measure the actual crease/dent metal deformation inside the mark.',
        'A small localized crease inside a large ellipse is still Category 1–2 if under 30mm.',
        'Each marked region confirms damage is present. Do not ignore marked areas.',
      ].join('\n')
    : '';

// ─── Pricing — canonical table lives in ../_shared/pricing.ts ────────────────
// Category resolution takes the MAXIMUM of all signals (never under-quote) and
// the price ALWAYS comes from the canonical table — AI dollar values are
// logged for telemetry but never trusted as the price source.

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_POLYGON: [number, number][] = [
  [0.2, 0.34], [0.32, 0.35], [0.31, 0.48], [0.2, 0.46],
];

const toPolygon = (raw?: number[][]): [number, number][] => {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_POLYGON;
  const points = raw
    .filter((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p) => [Number(p[0]), Number(p[1])] as [number, number]);
  return points.length >= 3 ? points : DEFAULT_POLYGON;
};

const severityMap: Record<string, 'Minor' | 'Moderate' | 'Severe'> = {
  minor: 'Minor', medium: 'Moderate', moderate: 'Moderate', severe: 'Severe',
};

const buildResponseFromOpenAI = (
  vehicleType: string,
  ai: OpenAIAnalysis,
  userPolygons: [number, number][][] = [],
) => {
  const resolvedDentCount = Math.max(0, Math.round(ai.dent_count || 0));
  const { category, reasons } = resolveCategory({
    aiCategory: ai.dent_category,
    sizeMm: parseSizeRangeUpperMm(ai.dent_size_range),
    sizeScore: ai.size_score,
    stressScore: ai.stress_score,
    geometryScore: ai.geometry_score,
    locationScore: ai.location_score,
    dentType: ai.dent_type,
    severity: ai.severity,
  });
  const markedCount = userPolygons.length;
  const dentCount = resolvedDentCount > 0
    ? resolvedDentCount
    : markedCount > 0
      ? markedCount
      : ai.damage_detected
        ? 1
        : 0;
  const { min, max } = dentCount > 0 ? priceForCategory(category, dentCount) : NO_PRICE;
  const largestDentMm = dentCount > 0 ? categoryMidpointMm(category) : 0;
  console.info('[analyze-dents-secure] OpenAI resolved price', {
    min,
    max,
    final_category: category,
    category_floors: reasons,
    ai_dent_category: ai.dent_category,
    ai_estimated_min_ignored: ai.estimated_min,
    ai_estimated_max_ignored: ai.estimated_max,
  });
  const scratchCount = Math.max(0, Math.round(ai.scratch_count || 0));
  const confidence = Math.min(0.99, Math.max(0.45, Number(ai.confidence || 0.82)));
  const severity = severityMap[String(ai.severity || 'minor').toLowerCase()] || 'Minor';
  const panelName = String(ai.panel_detected || 'doors').toLowerCase().replace(/\s+/g, '_');
  const hasPaintDamage = !!ai.needs_paint_repair || scratchCount > 0 || ai.pdr_suitability === 'poor' || ai.pdr_suitability === 'not_pdr';
  const reviewRequired = !!(ai.manual_review_recommended) || dentCount > 5 || ai.pdr_suitability === 'not_pdr';

  const aiTriage = {
    valid_image: ai.valid_image ?? true,
    image_is_vehicle: ai.image_is_vehicle ?? true,
    image_quality: ai.image_quality || 'acceptable',
    damage_detected: ai.damage_detected ?? true,
    panel_detected: ai.panel_detected || 'unknown',
    dent_category: category,
    category_floors_applied: reasons,
    dent_size_range: pricingByCategory(category).range,
    dent_type: ai.dent_type || 'soft_dent',
    severity: severity,
    size_score: Math.min(5, Math.max(1, Math.round(ai.size_score || 1))),
    stress_score: Math.min(5, Math.max(1, Math.round(ai.stress_score || 1))),
    geometry_score: Math.min(5, Math.max(1, Math.round(ai.geometry_score || 1))),
    location_score: Math.min(5, Math.max(1, Math.round(ai.location_score || 1))),
    access_score: Math.min(5, Math.max(1, Math.round(ai.access_score || 1))),
    pdr_suitability: ai.pdr_suitability || 'good',
    manual_review_recommended: reviewRequired,
    bodyshop_approval_required: true,
    suggested_base_price: Math.round(ai.suggested_base_price || min),
    reason: ai.reason || ai.notes || 'AI pre-analysis complete. Awaiting bodyshop approval.',
  };

  return {
    panels: [
      {
        panel_name: panelName,
        dent_count: dentCount,
        scratch_count: scratchCount,
        modifiers: {
          aluminium: false,
          access_difficulty: (ai.access_score || 1) >= 4 ? 'high' : (ai.access_score || 1) >= 3 ? 'medium' : 'low',
          hail_cluster: false,
        },
        estimated_panel_cost_AUD: { min, max },
        dents: dentCount > 0
          ? Array.from({ length: Math.min(dentCount, 5) }, () => ({
              size_cm: Math.round(largestDentMm / 10 * 10) / 10,
              depth: (ai.stress_score || 1) >= 4 ? 'Deep' : (ai.stress_score || 1) >= 3 ? 'Medium' : 'Shallow' as any,
              severity_score: Math.min(0.95, (((ai.size_score || 1) + (ai.stress_score || 1)) / 10)),
              confidence,
              polygon: DEFAULT_POLYGON,
            }))
          : [],
        scratches: [],
      },
    ],
    summary: {
      vehicle_type: vehicleType,
      total_dents: dentCount,
      total_scratches: scratchCount,
      overall_severity: severity,
      base_callout_applied: false,
      estimated_total_cost_AUD: { min, max },
      confidence_overall: confidence,
    },
    next_best_captures: [
      {
        tip: 'Take one closer side-angle photo with good lighting.',
        distance_m: '0.8m',
        reason: 'Improves confidence and panel-level pricing accuracy.',
      },
    ],
    flags: {
      review_required: reviewRequired,
      possible_reflection: false,
      pdr_incompatible: hasPaintDamage,
    },
    notes: ai.notes || 'Hybrid AI analysis: Gemini triage + OpenAI Vision deep analysis.',
    ai_triage: aiTriage,
    _source: 'openai',
  };
};

const buildResponseFromGemini = (
  vehicleType: string,
  model: GeminiDentModel,
  triage?: GeminiTriage,
  userPolygons: [number, number][][] = [],
) => {
  // If triage saw damage but Gemini returned 0 dents, trust triage (never under-count).
  let dentCount = Math.max(0, Math.round(model.dent_count || 0));
  if (dentCount === 0 && userPolygons.length > 0) {
    dentCount = userPolygons.length;
    console.info('[analyze-dents-secure] Gemini dent_count=0 but user marked regions — using', dentCount);
  } else if (dentCount === 0 && triage?.damage_detected) {
    dentCount = 1;
    console.info('[analyze-dents-secure] Gemini dent_count=0 but triage damage_detected — using 1');
  }
  const largestDentMm = (model.dents || []).reduce((m, d) => Math.max(m, (d.size_cm || 0) * 10), 0);
  const { category, reasons } = resolveCategory({
    aiCategory: categoryBySizeMm(largestDentMm),
    sizeMm: largestDentMm,
    severity: model.severity,
  });
  const { min, max } = dentCount > 0 ? priceForCategory(category, dentCount) : NO_PRICE;
  console.info('[analyze-dents-secure] Gemini resolved price', {
    min,
    max,
    final_category: category,
    category_floors: reasons,
    largestDentMm,
    ai_estimated_min_ignored: model.estimated_min,
    ai_estimated_max_ignored: model.estimated_max,
  });
  const scratchCount = Math.max(0, Math.round(model.scratch_count || 0));
  const confidence = Math.min(0.99, Math.max(0.45, Number(model.confidence || 0.82)));

  return {
    panels: [
      {
        panel_name: String(triage?.panel_detected || 'doors').toLowerCase().replace(/\s+/g, '_'),
        dent_count: dentCount,
        scratch_count: scratchCount,
        modifiers: {
          aluminium: false,
          access_difficulty: dentCount > 3 ? 'medium' : 'low',
          hail_cluster: false,
        },
        estimated_panel_cost_AUD: { min, max },
        dents: (model.dents || []).slice(0, 5).map((d) => ({
          size_cm: Number(d.size_cm || 2.1),
          depth: d.depth || 'Medium',
          severity_score: Number(d.severity_score || 0.4),
          confidence: Number(d.confidence || confidence),
          polygon: toPolygon(d.polygon),
        })),
        scratches: [],
      },
    ],
    summary: {
      vehicle_type: vehicleType,
      total_dents: dentCount,
      total_scratches: scratchCount,
      overall_severity: model.severity || 'Minor',
      base_callout_applied: false,
      estimated_total_cost_AUD: { min, max },
      confidence_overall: confidence,
    },
    next_best_captures: [
      {
        tip: 'Take one closer side-angle photo with better light.',
        distance_m: '0.8m',
        reason: 'Improves confidence and panel-level pricing.',
      },
    ],
    flags: {
      review_required: dentCount > 5,
      possible_reflection: false,
      pdr_incompatible: scratchCount > 0,
    },
    notes: model.notes || 'Gemini-only analysis (OpenAI not configured or unavailable).',
    _source: 'gemini',
  };
};

const hardFallback = (vehicleType: string, reason: string) => {
  console.warn('[analyze-dents-secure] hardFallback triggered:', reason);
  // HONESTY RULE: a failed analysis NEVER produces a price. Zero cost +
  // review_required routes the user to the inspection flow instead of
  // showing a fake Category 1 estimate.
  return {
    panels: [{
      panel_name: 'unknown',
      dent_count: 0,
      scratch_count: 0,
      modifiers: { aluminium: false, access_difficulty: 'low', hail_cluster: false },
      estimated_panel_cost_AUD: { ...NO_PRICE },
      dents: [],
      scratches: [],
    }],
    summary: {
      vehicle_type: vehicleType,
      total_dents: 0,
      total_scratches: 0,
      overall_severity: 'Unknown' as const,
      base_callout_applied: false,
      estimated_total_cost_AUD: { ...NO_PRICE },
      confidence_overall: 0.4,
    },
    next_best_captures: [{ tip: 'Please upload a clearer photo of the damaged panel.', distance_m: '0.8m', reason }],
    flags: { review_required: true, possible_reflection: false, pdr_incompatible: false },
    notes: reason,
    _source: 'fallback',
    _fallback_reason: reason,
    analysis_source: 'fallback',
    error_message: 'AI analysis incomplete — please upload a clearer image for an accurate estimate.',
  };
};

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return fail('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  try {
    const body = (await req.json()) as AnalyzeDentsInput;
    const images = Array.isArray(body.images) ? body.images : [];
    const imageTypes = Array.isArray(body.imageTypes) ? body.imageTypes : [];
    const userPolygons = Array.isArray(body.userPolygons) ? body.userPolygons : [];
    const userGuide = USER_GUIDE_PREFIX(userPolygons);

    if (!images.length) {
      return fail('No images provided', 'INVALID_PAYLOAD', 400);
    }

    const vehicleType = body.vehicleDetails?.vehicleType || 'sedan';
    const imageSlice = images.slice(0, 4).map((base64, i) => ({
      base64,
      mimeType: imageTypes[i] || 'image/jpeg',
    }));

    // ── Step 1: Gemini triage ────────────────────────────────────────────────
    let triage: GeminiTriage = {};
    try {
      triage = await generateGeminiJson<GeminiTriage>(GEMINI_TRIAGE_PROMPT, [imageSlice[0]]);
      console.info('[analyze-dents-secure] Gemini triage', {
        valid_image: triage.valid_image,
        image_is_vehicle: triage.image_is_vehicle,
        image_quality: triage.image_quality,
        damage_detected: triage.damage_detected,
        panel_detected: triage.panel_detected,
        detected_subject: triage.detected_subject,
      });
    } catch (triageError) {
      console.warn('[analyze-dents-secure] Gemini triage failed, proceeding', triageError);
    }

    // ── Reject non-vehicle content (strict) ──────────────────────────────────
    const subject = String(triage.detected_subject || '').toLowerCase();
    if (
      triage.valid_image === false ||
      triage.image_is_vehicle === false ||
      isNonVehicleSubject(subject)
    ) {
      console.info('[analyze-dents-secure] Blocked non-vehicle image', {
        detected_subject: triage.detected_subject,
        valid_image: triage.valid_image,
        image_is_vehicle: triage.image_is_vehicle,
      });
      return fail(
        'Please upload a clear exterior photo of your vehicle showing the damaged panel.',
        'INVALID_IMAGE',
        422,
      );
    }

    // ── If triage says image is unusable, return graceful fallback ───────────
    if (triage.image_quality === 'unusable') {
      console.info('[analyze-dents-secure] Image quality unusable, returning graceful fallback');
      return ok(hardFallback(vehicleType, 'Please upload a clearer photo showing the damaged area of the vehicle.'));
    }

    // ── Step 2a: OpenAI Vision deep analysis (preferred) ────────────────────
    let _openaiError: string | null = null;
    console.info('[analyze-dents-secure] isOpenAIConfigured:', isOpenAIConfigured());
    if (isOpenAIConfigured()) {
      try {
        const aiResult = await generateOpenAIVisionJson<OpenAIAnalysis>(
          OPENAI_DEEP_ANALYSIS_PROMPT + userGuide,
          imageSlice,
        );

        if (aiResult.valid_image === false || aiResult.image_is_vehicle === false) {
          console.info('[analyze-dents-secure] OpenAI rejected non-vehicle image', {
            valid_image: aiResult.valid_image,
            image_is_vehicle: aiResult.image_is_vehicle,
            notes: aiResult.notes,
          });
          return fail(
            'Please upload a clear exterior photo of your vehicle showing the damaged panel.',
            'INVALID_IMAGE',
            422,
          );
        }

        console.info('[analyze-dents-secure] OpenAI analysis complete', {
          dent_category: aiResult.dent_category,
          dent_type: aiResult.dent_type,
          severity: aiResult.severity,
          pdr_suitability: aiResult.pdr_suitability,
          manual_review_recommended: aiResult.manual_review_recommended,
        });
        return ok(buildResponseFromOpenAI(vehicleType, aiResult, userPolygons));
      } catch (openAIError) {
        _openaiError = String(openAIError);
        console.warn('[analyze-dents-secure] OpenAI failed, falling back to Gemini', _openaiError);
      }
    } else {
      _openaiError = 'OPENAI_API_KEY not configured in Supabase secrets';
      console.warn('[analyze-dents-secure]', _openaiError);
    }

    // ── Step 2b: Gemini dent analysis (fallback when OpenAI unavailable) ────
    try {
      const geminiResult = await generateGeminiJson<GeminiDentModel>(
        GEMINI_DENT_ANALYSIS_PROMPT + userGuide,
        imageSlice,
      );
      return ok({ ...buildResponseFromGemini(vehicleType, geminiResult, triage, userPolygons), _openai_error: _openaiError });
    } catch (geminiError) {
      console.warn('[analyze-dents-secure] Gemini analysis failed, using hard fallback', geminiError);
      return ok({ ...hardFallback(vehicleType, 'Fallback estimate used. Please upload a clearer photo for better accuracy.'), _openai_error: _openaiError });
    }
  } catch (error) {
    console.error('[analyze-dents-secure] error', error);
    return fail('Invalid request body', 'INVALID_JSON', 400);
  }
});
