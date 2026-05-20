import { corsHeaders, fail, ok } from '../_shared/response.ts';
import { generateGeminiJson } from '../_shared/gemini.ts';

type VerifyCarImageInput = {
  image?: string;
  imageType?: string;
};

type VerifyCarImageModelResponse = {
  is_valid?: boolean;
  is_car?: boolean;
  reason?: string;
  detected_subject?: string;
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
          'You are a strict image validation agent for a PDR (Paintless Dent Repair) automotive damage assessment system.',
          'Your ONLY job in this step is to determine whether the submitted image is valid for analysis.',
          'An image is ONLY valid if it meets ALL of the following criteria:',
          '1) The image clearly shows an exterior surface of a motor vehicle (car, truck, van, SUV, or motorcycle body panel).',
          '2) The vehicle surface must be visible and in focus enough to assess for dents or damage.',
          '3) The image is not a screenshot, illustration, design mockup, render, document, logo, or digital interface.',
          '4) The image is not an interior shot, engine bay, tyre, wheel, or undercarriage.',
          'Respond ONLY with strict JSON: {"is_valid": boolean, "reason": string, "detected_subject": string}.',
          'If unsure, return is_valid=false.',
        ].join('\n'),
        [{ base64: image, mimeType: imageType || 'image/jpeg' }],
      );

      const detectedSubject = String(modelResult.detected_subject || '').toLowerCase();
      const nonVehicleSignals = /(screenshot|interface|ui|dashboard|website|document|logo|illustration|mockup|render)/;
      const strictInvalid = nonVehicleSignals.test(detectedSubject);
      const modelSaysValid = modelResult.is_valid ?? modelResult.is_car ?? false;
      const isCar = strictInvalid ? false : !!modelSaysValid;

      return ok({
        is_car: isCar,
        reason: modelResult.reason || (isCar ? 'Vehicle exterior verified for dent analysis.' : 'Could not confidently verify a valid exterior vehicle damage image.'),
      });
    } catch (modelError) {
      console.warn('[verify-car-image] Gemini unavailable, failing closed for strict validation', modelError);
      return ok({
        is_car: false,
        reason: 'Could not verify a valid exterior vehicle image at this time. Please upload a clear car panel photo.',
      });
    }
  } catch (error) {
    console.error('[verify-car-image] error', error);
    return fail('Invalid request body', 'INVALID_JSON', 400);
  }
});
