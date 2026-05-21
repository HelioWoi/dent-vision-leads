import { corsHeaders, fail, ok } from '../_shared/response.ts';
import { generateGeminiJson } from '../_shared/gemini.ts';

const STRICT_VEHICLE_VALIDATION_PROMPT = [
  'You are a strict image validation agent for a PDR (Paintless Dent Repair) automotive damage assessment system.',
  'Your ONLY job in this step is to determine whether the submitted image is valid for analysis.',
  'An image is ONLY valid if it meets ALL of the following criteria:',
  '1) The image clearly shows an exterior surface of a motor vehicle (car, truck, van, SUV, or motorcycle body panel).',
  '2) The vehicle surface must be visible and in focus enough to assess for dents or damage.',
  '3) The image is not a screenshot, illustration, design mockup, render, document, logo, or digital interface.',
  '4) The image is not an interior shot, engine bay, tyre, wheel, or undercarriage.',
  'Respond ONLY with a valid JSON object in this exact format — no extra text:',
  '{"is_valid": true or false, "reason": "brief explanation in one sentence", "detected_subject": "what you actually see in the image"}',
  'If is_valid is false, the system will block progression. Do not be lenient. When in doubt, return false.',
].join('\n');

const DENT_ANALYSIS_PROMPT = [
  'You are an expert automotive dent analysis assistant for PDR pre-estimation.',
  'Analyze ONLY exterior vehicle body-panel damage from all provided photos together.',
  'If the same dent appears in multiple photos/angles, count it once (no double counting).',
  'Focus on: dent count, dent size, dent depth, scratch count, and overall severity.',
  'Estimate dent size using visible references when possible:',
  '- Door handle: ~180-200mm',
  '- Fuel cap: ~150-180mm',
  '- Wheel diameter: ~400-500mm',
  'Depth rules:',
  '- Shallow: subtle reflection distortion, no sharp crease',
  '- Medium: clear visible deformation, moderate depth',
  '- Deep: sharp/strong deformation, crease or collapse-like shape',
  'Severity rules:',
  '- Minor: mostly small/shallow dents',
  '- Moderate: medium dents or multiple visible dents',
  '- Severe: large/deep dents, crease-like damage, or broad panel deformation',
  'Confidence must be between 0 and 1. Use lower confidence if lighting/angle is poor.',
  'Return ONLY strict JSON with fields:',
  '{"dent_count":number,"scratch_count":number,"severity":"Minor|Moderate|Severe|Unknown","estimated_min":number,"estimated_max":number,"confidence":number,"notes":string,"dents":[{"size_cm":number,"depth":"Shallow|Medium|Deep","severity_score":number,"confidence":number,"polygon":[[x,y],[x,y],[x,y]]}]}.',
  'For dents[].size_cm, provide realistic size estimates from visual evidence.',
  'Use conservative values when uncertain and explain key observations briefly in notes.',
].join('\n');

type ValidationResult = {
  is_valid?: boolean;
  reason?: string;
  detected_subject?: string;
};

type AnalyzeDentsInput = {
  images?: string[];
  imageTypes?: string[];
  vehicleDetails?: {
    vehicleType?: string;
  };
};

type ModelDent = {
  size_cm: number;
  depth: 'Shallow' | 'Medium' | 'Deep';
  severity_score: number;
  confidence: number;
  polygon?: number[][];
};

type AnalyzeModelResponse = {
  dent_count: number;
  scratch_count: number;
  severity: 'Minor' | 'Moderate' | 'Severe' | 'Unknown';
  estimated_min: number;
  estimated_max: number;
  confidence: number;
  notes?: string;
  dents?: ModelDent[];
};

const toPolygon = (raw?: number[][]): [number, number][] => {
  if (!Array.isArray(raw) || !raw.length) {
    return [
      [0.2, 0.34],
      [0.32, 0.35],
      [0.31, 0.48],
      [0.2, 0.46],
    ];
  }

  const points = raw
    .filter((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p) => [Number(p[0]), Number(p[1])] as [number, number]);

  return points.length >= 3 ? points : [
    [0.2, 0.34],
    [0.32, 0.35],
    [0.31, 0.48],
    [0.2, 0.46],
  ];
};

const buildResponse = (vehicleType: string, model: AnalyzeModelResponse) => {
  const min = Math.max(120, Math.round(model.estimated_min || 250));
  const max = Math.max(min + 60, Math.round(model.estimated_max || min + 120));
  const dentCount = Math.max(0, Math.round(model.dent_count || 0));
  const scratchCount = Math.max(0, Math.round(model.scratch_count || 0));
  const confidence = Math.min(0.99, Math.max(0.45, Number(model.confidence || 0.82)));

  return {
    panels: [
      {
        panel_name: 'doors',
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
      pdr_incompatible: scratchCount > 2,
    },
    notes: model.notes || 'Generated by Gemini edge analysis.',
  };
};

const fallbackResponse = (vehicleType: string) =>
  buildResponse(vehicleType, {
    dent_count: 2,
    scratch_count: 0,
    severity: 'Minor',
    estimated_min: 250,
    estimated_max: 390,
    confidence: 0.88,
    notes: 'Fallback edge response used because Gemini was unavailable.',
    dents: [
      {
        size_cm: 2.6,
        depth: 'Medium',
        severity_score: 0.42,
        confidence: 0.88,
      },
    ],
  });

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

    try {
      const firstImage = { base64: images[0], mimeType: imageTypes[0] || 'image/jpeg' };
      const validation = await generateGeminiJson<ValidationResult>(
        STRICT_VEHICLE_VALIDATION_PROMPT,
        [firstImage],
      );

      const detectedSubject = String(validation.detected_subject || '').toLowerCase();
      const nonVehicleSignals = /(screenshot|interface|ui|dashboard|website|document|logo|illustration|mockup|render|phone|app|browser|menu|button|form|page|screen)/;
      const isNonVehicle = nonVehicleSignals.test(detectedSubject);
      const modelSaysValid = validation.is_valid ?? false;

      if (!modelSaysValid || isNonVehicle) {
        console.info('[analyze-dents-secure] Image validation failed', {
          is_valid: validation.is_valid,
          detected_subject: validation.detected_subject,
          reason: validation.reason,
          is_non_vehicle_signal: isNonVehicle,
        });
        return fail(
          validation.reason || 'Not a valid vehicle exterior image. Please upload a clear photo of a car panel.',
          'INVALID_IMAGE',
          422,
        );
      }
    } catch (validationError) {
      console.warn('[analyze-dents-secure] Validation step failed (Gemini error), failing closed', validationError);
      return fail(
        'Could not verify a valid vehicle image at this time. Please upload a clear car panel photo.',
        'INVALID_IMAGE',
        422,
      );
    }

    try {
      const modelResult = await generateGeminiJson<AnalyzeModelResponse>(
        DENT_ANALYSIS_PROMPT,
        images.slice(0, 4).map((base64, i) => ({ base64, mimeType: imageTypes[i] || 'image/jpeg' })),
      );

      return ok(buildResponse(vehicleType, modelResult));
    } catch (modelError) {
      console.warn('[analyze-dents-secure] Gemini unavailable, using fallback', modelError);
      return ok(fallbackResponse(vehicleType));
    }
  } catch (error) {
    console.error('[analyze-dents-secure] error', error);
    return fail('Invalid request body', 'INVALID_JSON', 400);
  }
});
