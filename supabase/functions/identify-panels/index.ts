import { corsHeaders, fail, ok } from '../_shared/response.ts';
import { generateGeminiJson } from '../_shared/gemini.ts';

type IdentifyPanelsInput = {
  images?: string[];
  imageTypes?: string[];
};

type IdentifyPanelsModelResponse = {
  panels: string[];
};

const ALLOWED_PANELS = ['bonnet', 'guard', 'doors', 'roof', 'boot', 'bumper', 'cant_rail'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return fail('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  try {
    const body = (await req.json()) as IdentifyPanelsInput;
    const images = Array.isArray(body.images) ? body.images : [];
    const imageTypes = Array.isArray(body.imageTypes) ? body.imageTypes : [];

    if (!images.length) {
      return fail('No images provided', 'INVALID_PAYLOAD', 400);
    }

    try {
      const modelResult = await generateGeminiJson<IdentifyPanelsModelResponse>(
        [
          'You classify which vehicle exterior panel appears damaged.',
          'Return ONLY strict JSON: {"panels": string[]}.',
          `Allowed panel values: ${ALLOWED_PANELS.join(', ')}.`,
          'Return 1-2 most likely panel names in lowercase.',
        ].join('\n'),
        images.slice(0, 3).map((base64, i) => ({ base64, mimeType: imageTypes[i] || 'image/jpeg' })),
      );

      const normalized = (modelResult.panels || [])
        .map((p) => String(p).toLowerCase().trim())
        .filter((p) => ALLOWED_PANELS.includes(p));

      return ok({ panels: normalized.length ? Array.from(new Set(normalized)) : ['doors'] });
    } catch (modelError) {
      console.warn('[identify-panels] Gemini unavailable, using fallback', modelError);
      return ok({ panels: ['doors'] });
    }
  } catch (error) {
    console.error('[identify-panels] error', error);
    return fail('Invalid request body', 'INVALID_JSON', 400);
  }
});
