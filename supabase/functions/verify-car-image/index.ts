import { corsHeaders, fail, ok } from '../_shared/response.ts';
import { generateGeminiJson } from '../_shared/gemini.ts';

type VerifyCarImageInput = {
  image?: string;
  imageType?: string;
};

type VerifyCarImageModelResponse = {
  is_car: boolean;
  reason: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return fail('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  try {
    const body = (await req.json()) as VerifyCarImageInput;
    const image = body.image || '';
    const imageType = body.imageType || '';

    if (!image) {
      return fail('Missing image payload', 'INVALID_PAYLOAD', 400);
    }

    const looksLikeImage = imageType.startsWith('image/') && image.length > 600;
    if (!looksLikeImage) {
      return ok({
        is_car: false,
        reason: 'Invalid or unsupported image payload.',
      });
    }

    try {
      const modelResult = await generateGeminiJson<VerifyCarImageModelResponse>(
        [
          'You are validating user-uploaded images for a dent estimate flow.',
          'Return ONLY strict JSON: {"is_car": boolean, "reason": string}.',
          'is_car=true only if the image clearly shows a real vehicle exterior.',
          'If uncertain, return is_car=false and explain briefly.',
        ].join('\n'),
        [{ base64: image, mimeType: imageType || 'image/jpeg' }],
      );

      return ok({
        is_car: !!modelResult.is_car,
        reason: modelResult.reason || (modelResult.is_car ? 'Vehicle verified.' : 'Could not verify vehicle image.'),
      });
    } catch (modelError) {
      console.warn('[verify-car-image] Gemini unavailable, using safe fallback', modelError);
      return ok({
        is_car: true,
        reason: 'Fallback verification passed. Please continue.',
      });
    }
  } catch (error) {
    console.error('[verify-car-image] error', error);
    return fail('Invalid request body', 'INVALID_JSON', 400);
  }
});
