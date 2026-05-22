import { corsHeaders, fail, ok } from '../_shared/response.ts';
import { generateGeminiJson } from '../_shared/gemini.ts';
import { generateOpenAIVisionJson, isOpenAIConfigured } from '../_shared/openai.ts';

// ─── Step 1: Gemini Flash triage — fast, cheap, determines image usability ────

const GEMINI_TRIAGE_PROMPT = [
  'You are a fast image triage agent for a PDR (Paintless Dent Repair) automotive system.',
  'Quickly assess whether this image shows a vehicle exterior suitable for dent analysis.',
  'Return ONLY valid JSON, no extra text:',
  '{"valid_image":boolean,"image_is_vehicle":boolean,"image_quality":"good|acceptable|poor|unusable","damage_detected":boolean,"panel_detected":"panel name or unknown","detected_subject":"brief description","needs_better_image":boolean,"better_image_reason":null}',
  'Rules:',
  '- valid_image=true if the image shows any exterior part of a vehicle, even a close-up panel with a dent.',
  '- image_is_vehicle=true for close-up shots of panels, dents, bodywork, or paint.',
  '- damage_detected=true if any dents, creases, scratches, or deformation are visible.',
  '- needs_better_image=true ONLY if the image is too dark, too blurry, or the angle prevents damage assessment.',
  '- Set detected_subject to a short description of exactly what you see.',
].join('\n');

// ─── Step 2: OpenAI Vision deep analysis — scoring, classification, reasoning ─

const OPENAI_DEEP_ANALYSIS_PROMPT = [
  'You are an expert PDR (Paintless Dent Repair) damage analysis system for pre-estimation.',
  'Analyze the provided vehicle damage image(s) and return a detailed structured assessment.',
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
  'CLASSIFICATION FACTORS (not just size):',
  '- Reflection distortion: subtle=shallow, strong=deep deformation',
  '- Deformation area vs visible size',
  '- Metal stress: creases, sharp edges, collapsed metal',
  '- Dent geometry: round, irregular, linear crease',
  '- Panel location: center flat, near bodyline, near wheel arch, edge',
  '- Repair accessibility: open flat vs hidden vs near trim/handles',
  '- Edge or bodyline involvement',
  '- Paint damage indicators (cracks, chips, exposed primer)',
  '- Bumper collapse or structural deformation appearance',
  '',
  'DENT TYPES: soft_dent | sharp_dent | crease_dent | collapsed_dent | bodyline_dent | edge_dent | bumper_damage | collision_like',
  '',
  'SCORING (1–5 each):',
  'size_score: 1=tiny(<30mm) 2=small 3=medium 4=large 5=massive(>260mm)',
  'stress_score: 1=soft(no stress) 2=light 3=moderate 4=sharp/crease 5=collapsed/heavy',
  'geometry_score: 1=simple round 2=oval 3=irregular 4=linear 5=complex crease',
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
  '',
  'IMPORTANT:',
  '- If no damage visible, set damage_detected=false and suggested_base_price=0',
  '- If collision/structural suspected, set manual_review_recommended=true',
  '- Count dents conservatively; do not double-count across angles',
  '- Use vehicle references: door handle ~180mm, fuel cap ~165mm, wheel ~450mm',
  '',
  'Return ONLY valid JSON, no extra text:',
  '{"valid_image":boolean,"image_is_vehicle":boolean,"image_quality":"good|acceptable|poor|unusable","damage_detected":boolean,"panel_detected":string,"dent_count":number,"scratch_count":number,"dent_category":number,"dent_size_range":string,"dent_type":string,"severity":"minor|medium|severe","estimated_min":number,"estimated_max":number,"size_score":number,"stress_score":number,"geometry_score":number,"location_score":number,"access_score":number,"pdr_suitability":"excellent|good|fair|poor|not_pdr","manual_review_recommended":boolean,"bodyshop_approval_required":true,"suggested_base_price":number,"confidence":number,"notes":string,"reason":string}',
].join('\n');

// ─── Gemini fallback analysis (used when OpenAI is unavailable) ───────────────

const GEMINI_DENT_ANALYSIS_PROMPT = [
  'You are an expert automotive dent analysis assistant for PDR pre-estimation.',
  'Analyze ONLY exterior vehicle body-panel damage from all provided photos together.',
  'If the same dent appears in multiple photos/angles, count it once (no double counting).',
  'Estimate dent size using: door handle ~180mm, fuel cap ~165mm, wheel ~450mm.',
  'Depth: Shallow=subtle reflection distortion | Medium=clear deformation | Deep=sharp crease/collapse.',
  'Severity: Minor=small/shallow | Moderate=medium or multiple | Severe=large/deep/crease/broad deformation.',
  'PRICING TABLE (AUD) — use these exact values for estimated_min/estimated_max:',
  '0-30mm: $118-$144 | 31-60mm: $180-$220 | 61-90mm: $258-$315',
  '91-160mm: $293-$357 | 161-260mm: $392-$478 | 261-400mm: $490-$598 | 400-600mm: $680-$830',
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
  vehicleDetails?: { vehicleType?: string };
};

// ─── Pricing Table — canonical source of truth (AUD, 22% margin) ────────────

const PRICING_TABLE = [
  { category: 1, range: '0-30mm',    minMm:   0, maxMm:  30, priceMin: 118, priceMax: 144 },
  { category: 2, range: '31-60mm',   minMm:  31, maxMm:  60, priceMin: 180, priceMax: 220 },
  { category: 3, range: '61-90mm',   minMm:  61, maxMm:  90, priceMin: 258, priceMax: 315 },
  { category: 4, range: '91-160mm',  minMm:  91, maxMm: 160, priceMin: 293, priceMax: 357 },
  { category: 5, range: '161-260mm', minMm: 161, maxMm: 260, priceMin: 392, priceMax: 478 },
  { category: 6, range: '261-400mm', minMm: 261, maxMm: 400, priceMin: 490, priceMax: 598 },
  { category: 7, range: '400-600mm', minMm: 401, maxMm: 600, priceMin: 680, priceMax: 830 },
] as const;

const pricingByCategory = (cat: number) =>
  PRICING_TABLE[Math.min(6, Math.max(0, Math.round(cat || 1) - 1))];

const pricingBySizeMm = (sizeMm: number) => {
  for (const r of PRICING_TABLE) {
    if (sizeMm >= r.minMm && sizeMm <= r.maxMm) return r;
  }
  return sizeMm > 0 ? PRICING_TABLE[6] : PRICING_TABLE[0];
};

const resolvePrice = (
  aiMin: number | undefined,
  aiMax: number | undefined,
  category: number | undefined,
  largestDentMm: number,
): { min: number; max: number } => {
  // 1. Trust AI-provided prices when non-zero
  if (aiMin && aiMin > 0) {
    const resolvedMax = aiMax && aiMax > aiMin ? Math.round(aiMax) : Math.round(aiMin * 1.22);
    console.info('[pricing] Using AI-provided prices', { aiMin, resolvedMax });
    return { min: Math.round(aiMin), max: resolvedMax };
  }
  // 2. Map AI dent_category (1-7) to pricing table
  if (category && category >= 1 && category <= 7) {
    const entry = pricingByCategory(category);
    console.info('[pricing] Using category lookup', { category, entry });
    return { min: entry.priceMin, max: entry.priceMax };
  }
  // 3. Map dent size in mm to pricing table
  if (largestDentMm > 0) {
    const entry = pricingBySizeMm(largestDentMm);
    console.info('[pricing] Using size lookup', { largestDentMm, entry });
    return { min: entry.priceMin, max: entry.priceMax };
  }
  // 4. Last resort: Category 1 minimum — NEVER $250 hardcoded default
  console.warn('[pricing] No pricing signals from AI — using Category 1 minimum $118/$144');
  return { min: 118, max: 144 };
};

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

const buildResponseFromOpenAI = (vehicleType: string, ai: OpenAIAnalysis) => {
  const dentCount = Math.max(0, Math.round(ai.dent_count || 0));
  const largestDentMm = dentCount > 0 ? (ai.dent_category || 1) * 30 : 0;
  const { min, max } = resolvePrice(ai.estimated_min, ai.estimated_max, ai.dent_category, largestDentMm);
  console.info('[analyze-dents-secure] OpenAI resolved price', { min, max, dent_category: ai.dent_category, estimated_min: ai.estimated_min, estimated_max: ai.estimated_max });
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
    dent_category: Math.min(7, Math.max(1, Math.round(ai.dent_category || 1))),
    dent_size_range: ai.dent_size_range || '0-30mm',
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
              size_cm: Math.round(((ai.dent_category || 1) * 1.8 + 1) * 10) / 10,
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

const buildResponseFromGemini = (vehicleType: string, model: GeminiDentModel, triage?: GeminiTriage) => {
  const dentCount = Math.max(0, Math.round(model.dent_count || 0));
  const largestDentMm = (model.dents || []).reduce((m, d) => Math.max(m, (d.size_cm || 0) * 10), 0);
  const { min, max } = resolvePrice(model.estimated_min, model.estimated_max, undefined, largestDentMm);
  console.info('[analyze-dents-secure] Gemini resolved price', { min, max, estimated_min: model.estimated_min, estimated_max: model.estimated_max, largestDentMm });
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
  const entry = PRICING_TABLE[0];
  return {
    panels: [{
      panel_name: 'unknown',
      dent_count: 0,
      scratch_count: 0,
      modifiers: { aluminium: false, access_difficulty: 'low', hail_cluster: false },
      estimated_panel_cost_AUD: { min: entry.priceMin, max: entry.priceMax },
      dents: [],
      scratches: [],
    }],
    summary: {
      vehicle_type: vehicleType,
      total_dents: 0,
      total_scratches: 0,
      overall_severity: 'Unknown' as const,
      base_callout_applied: false,
      estimated_total_cost_AUD: { min: entry.priceMin, max: entry.priceMax },
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

    // ── Reject only clear non-vehicle content ────────────────────────────────
    const subject = String(triage.detected_subject || '').toLowerCase();
    const hardNonVehicle = /\b(screenshot|interface|website|document|logo|illustration|mockup|render|receipt|invoice|id\s*card|credit\s*card)\b/;
    const invalidPart = /\b(interior cabin|dashboard view|steering wheel|engine bay|undercarriage|wheel only)\b/;

    if (hardNonVehicle.test(subject) || invalidPart.test(subject)) {
      console.info('[analyze-dents-secure] Hard-blocked non-vehicle', { detected_subject: triage.detected_subject });
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
          OPENAI_DEEP_ANALYSIS_PROMPT,
          imageSlice,
        );
        console.info('[analyze-dents-secure] OpenAI analysis complete', {
          dent_category: aiResult.dent_category,
          dent_type: aiResult.dent_type,
          severity: aiResult.severity,
          pdr_suitability: aiResult.pdr_suitability,
          manual_review_recommended: aiResult.manual_review_recommended,
        });
        return ok(buildResponseFromOpenAI(vehicleType, aiResult));
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
        GEMINI_DENT_ANALYSIS_PROMPT,
        imageSlice,
      );
      return ok({ ...buildResponseFromGemini(vehicleType, geminiResult, triage), _openai_error: _openaiError });
    } catch (geminiError) {
      console.warn('[analyze-dents-secure] Gemini analysis failed, using hard fallback', geminiError);
      return ok({ ...hardFallback(vehicleType, 'Fallback estimate used. Please upload a clearer photo for better accuracy.'), _openai_error: _openaiError });
    }
  } catch (error) {
    console.error('[analyze-dents-secure] error', error);
    return fail('Invalid request body', 'INVALID_JSON', 400);
  }
});
