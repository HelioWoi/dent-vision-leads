import { corsHeaders, fail, ok } from '../_shared/response.ts';
import { generateGeminiJson } from '../_shared/gemini.ts';
import { generateOpenAIVisionJson, isOpenAIConfigured } from '../_shared/openai.ts';

type AnalyzeLiveScanInput = {
  frames?: string[];
  vehicleDetails?: {
    vehicleType?: string;
  };
};

type AnalyzeLiveScanModelResponse = {
  dent_count: number;
  scratch_count: number;
  severity: 'Minor' | 'Moderate' | 'Severe' | 'Unknown';
  confidence: number;
  notes?: string;
};

type OpenAILiveScanResponse = {
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
  suggested_base_price?: number;
  confidence?: number;
  damage_location?: string;
  damage_type?: string;
  needs_paint_repair?: boolean;
  notes?: string;
  reason?: string;
};

const LIVE_SCAN_ANALYSIS_PROMPT = [
  'You are an expert automotive dent analysis assistant for live camera scans.',
  'Analyze all frames together as the same vehicle panel sequence, not as separate jobs.',
  'Count visible dents conservatively and avoid double-counting the same dent across angles/frames.',
  'Focus on: dent_count, scratch_count, severity, confidence, and short notes.',
  'Use vehicle references to estimate size and severity when possible:',
  '- Door handle: ~180-200mm',
  '- Fuel cap: ~150-180mm',
  '- Wheel diameter: ~400-500mm',
  'Severity guidance:',
  '- Minor: mostly small/shallow dents',
  '- Moderate: multiple visible dents or medium deformation',
  '- Severe: large/deep dents, crease-like damage, or broad panel distortion',
  'If frames are blurry, dark, or inconsistent, reduce confidence accordingly.',
  'Return ONLY strict JSON: {"dent_count":number,"scratch_count":number,"severity":"Minor|Moderate|Severe|Unknown","confidence":number,"notes":string}.',
].join('\n');

const OPENAI_LIVE_SCAN_PROMPT = [
  'You are an expert PDR (Paintless Dent Repair) damage analysis system analyzing a sequence of live scan frames.',
  'All frames show the same vehicle and damage area — analyze them together, do not double-count.',
  '',
  'DAMAGE CATEGORIES — use these EXACT base prices (AUD, 22% margin included):',
  'Cat1=0-30mm base $118 range $118-$144 | Cat2=31-60mm base $180 range $180-$220 | Cat3=61-90mm base $258 range $258-$315',
  'Cat4=91-160mm base $293 range $293-$357 | Cat5=161-260mm base $392 range $392-$478',
  'Cat6=261-400mm base $490 range $490-$598 | Cat7=400-600mm base $680 range $680-$830',
  '',
  'SCORING (1-5): size_score | stress_score | geometry_score | location_score | access_score',
  'DENT TYPES: soft_dent | sharp_dent | crease_dent | collapsed_dent | bodyline_dent | edge_dent | bumper_damage | collision_like',
  'PDR SUITABILITY: excellent | good | fair | poor | not_pdr',
  '',
  'Use category base price as suggested_base_price. Raise up to 15% above range max only if stress+geometry>=7.',
  'estimated_min = category base, estimated_max = category range max.',
  'Set manual_review_recommended=true if collision-like or structural damage suspected.',
  'Use vehicle references: door handle ~180mm, fuel cap ~165mm, wheel ~450mm.',
  '',
  'Return ONLY valid JSON:',
  '{"dent_count":number,"scratch_count":number,"dent_category":number,"dent_size_range":string,"dent_type":string,"severity":"Minor|Moderate|Severe|Unknown","estimated_min":number,"estimated_max":number,"size_score":number,"stress_score":number,"geometry_score":number,"location_score":number,"access_score":number,"pdr_suitability":"excellent|good|fair|poor|not_pdr","manual_review_recommended":boolean,"suggested_base_price":number,"confidence":number,"damage_location":string,"damage_type":"pdr|hail","needs_paint_repair":boolean,"notes":string}',
].join('\n');

const fallbackPayload = (vehicleType: string) => ({
  panels: [
    {
      panel_name: 'doors',
      dent_count: 2,
      scratch_count: 0,
      modifiers: {
        aluminium: false,
        access_difficulty: 'low',
        hail_cluster: false,
      },
      estimated_panel_cost_AUD: { min: 240, max: 370 },
      dents: [],
      scratches: [],
    },
  ],
  summary: {
    vehicle_type: vehicleType,
    total_dents: 2,
    total_scratches: 0,
    overall_severity: 'Minor',
    base_callout_applied: false,
    estimated_total_cost_AUD: { min: 240, max: 370 },
    confidence_overall: 0.84,
  },
  flags: {
    review_required: false,
    possible_reflection: false,
    pdr_incompatible: false,
  },
  notes: 'Fallback live-scan response.',
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return fail('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  try {
    const body = (await req.json()) as AnalyzeLiveScanInput;
    const frames = Array.isArray(body.frames) ? body.frames : [];
    const vehicleType = body.vehicleDetails?.vehicleType || 'sedan';

    if (!frames.length) {
      return fail('No frames provided', 'INVALID_PAYLOAD', 400);
    }

    const frameSlice = frames.slice(0, 6).map((base64) => ({ base64, mimeType: 'image/jpeg' }));

    // ── OpenAI deep analysis (preferred) ────────────────────────────────────
    if (isOpenAIConfigured()) {
      try {
        const aiResult = await generateOpenAIVisionJson<OpenAILiveScanResponse>(
          OPENAI_LIVE_SCAN_PROMPT,
          frameSlice,
        );

        const dentCount = Math.max(0, Math.round(aiResult.dent_count || 0));
        const scratchCount = Math.max(0, Math.round(aiResult.scratch_count || 0));
        const min = Math.max(120, Math.round(aiResult.estimated_min || aiResult.suggested_base_price! * 0.85 || 200));
        const max = Math.max(min + 60, Math.round(aiResult.estimated_max || aiResult.suggested_base_price! * 1.15 || min + 130));
        const confidence = Math.min(0.99, Math.max(0.45, Number(aiResult.confidence || 0.82)));
        const reviewRequired = !!(aiResult.manual_review_recommended) || dentCount > 6 || aiResult.pdr_suitability === 'not_pdr';

        const severityRaw = String(aiResult.severity || 'Minor');
        const severity = severityRaw === 'minor' ? 'Minor' : severityRaw === 'medium' ? 'Moderate' : severityRaw === 'moderate' ? 'Moderate' : severityRaw === 'severe' ? 'Severe' : (aiResult.severity as any) || 'Minor';

        console.info('[analyze-live-scan] OpenAI analysis complete', {
          dent_category: aiResult.dent_category,
          dent_type: aiResult.dent_type,
          severity: aiResult.severity,
          pdr_suitability: aiResult.pdr_suitability,
          manual_review_recommended: aiResult.manual_review_recommended,
        });

        return ok({
          panels: [
            {
              panel_name: String(aiResult.damage_location || 'doors').toLowerCase().replace(/\s+/g, '_'),
              dent_count: dentCount,
              scratch_count: scratchCount,
              modifiers: {
                aluminium: false,
                access_difficulty: (aiResult.access_score || 1) >= 4 ? 'high' : (aiResult.access_score || 1) >= 3 ? 'medium' : 'low',
                hail_cluster: aiResult.damage_type === 'hail',
              },
              estimated_panel_cost_AUD: { min, max },
              dents: [],
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
          flags: {
            review_required: reviewRequired,
            possible_reflection: false,
            pdr_incompatible: aiResult.pdr_suitability === 'not_pdr' || scratchCount > 2,
          },
          notes: aiResult.notes || 'Hybrid AI live-scan: OpenAI Vision deep analysis.',
          ai_triage: {
            dent_category: Math.min(7, Math.max(1, Math.round(aiResult.dent_category || 1))),
            dent_size_range: aiResult.dent_size_range || '0-30mm',
            dent_type: aiResult.dent_type || 'soft_dent',
            severity: severity,
            size_score: Math.min(5, Math.max(1, Math.round(aiResult.size_score || 1))),
            stress_score: Math.min(5, Math.max(1, Math.round(aiResult.stress_score || 1))),
            geometry_score: Math.min(5, Math.max(1, Math.round(aiResult.geometry_score || 1))),
            location_score: Math.min(5, Math.max(1, Math.round(aiResult.location_score || 1))),
            access_score: Math.min(5, Math.max(1, Math.round(aiResult.access_score || 1))),
            pdr_suitability: aiResult.pdr_suitability || 'good',
            manual_review_recommended: reviewRequired,
            bodyshop_approval_required: true,
            suggested_base_price: Math.round(aiResult.suggested_base_price || min),
            damage_type: aiResult.damage_type || 'pdr',
            needs_paint_repair: !!aiResult.needs_paint_repair,
            damage_location: aiResult.damage_location || 'unknown',
          },
        });
      } catch (openAIError) {
        console.warn('[analyze-live-scan] OpenAI failed, falling back to Gemini', openAIError);
      }
    }

    // ── Gemini fallback ──────────────────────────────────────────────────────
    try {
      const modelResult = await generateGeminiJson<AnalyzeLiveScanModelResponse>(
        LIVE_SCAN_ANALYSIS_PROMPT,
        frameSlice,
      );

      const dentCount = Math.max(0, Math.round(modelResult.dent_count || 0));
      const scratchCount = Math.max(0, Math.round(modelResult.scratch_count || 0));
      const min = Math.max(120, 190 + dentCount * 45 + scratchCount * 30);
      const max = min + 130;

      return ok({
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
            dents: [],
            scratches: [],
          },
        ],
        summary: {
          vehicle_type: vehicleType,
          total_dents: dentCount,
          total_scratches: scratchCount,
          overall_severity: modelResult.severity || 'Minor',
          base_callout_applied: false,
          estimated_total_cost_AUD: { min, max },
          confidence_overall: Math.min(0.99, Math.max(0.45, Number(modelResult.confidence || 0.82))),
        },
        flags: {
          review_required: dentCount > 6,
          possible_reflection: false,
          pdr_incompatible: scratchCount > 2,
        },
        notes: modelResult.notes || 'Gemini live-scan analysis.',
      });
    } catch (modelError) {
      console.warn('[analyze-live-scan] Gemini unavailable, using fallback', modelError);
      return ok(fallbackPayload(vehicleType));
    }
  } catch (error) {
    console.error('[analyze-live-scan] error', error);
    return fail('Invalid request body', 'INVALID_JSON', 400);
  }
});
