import { corsHeaders, fail, ok } from '../_shared/response.ts';
import { generateGeminiJson } from '../_shared/gemini.ts';
import { isVehicleImageAccepted } from '../_shared/imageValidation.ts';

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
          'You are a strict image gatekeeper for a PDR (Paintless Dent Repair) automotive damage system.',
          'ONLY accept clear photos of vehicle EXTERIOR panels, paint, dents, scratches, or bodywork.',
          'REJECT (is_valid=false) for ANY of these:',
          '- Screenshots, UI, websites, apps, dashboards, spreadsheets, documents, presentations',
          '- Project management boards, task lists, charts, tables, progress bars',
          '- People, food, animals, furniture, interiors, engine bays, unrelated objects',
          '- Blurry images where no vehicle surface is visible',
          'When unsure whether it is a vehicle exterior photo, set is_valid=false.',
          'Respond ONLY with strict JSON: {"is_valid": boolean, "reason": string, "detected_subject": string}.',
        ].join('\n'),
        [{ base64: image, mimeType: imageType || 'image/jpeg' }],
      );

      const decision = isVehicleImageAccepted({
        isValid: modelResult.is_valid,
        isCar: modelResult.is_car,
        detectedSubject: modelResult.detected_subject,
      });

      console.info('[verify-car-image]', {
        is_car: decision.accepted,
        detected_subject: modelResult.detected_subject,
        model_is_valid: modelResult.is_valid,
        reason: decision.reason,
      });

      return ok({
        is_car: decision.accepted,
        reason: modelResult.reason || decision.reason,
      });
    } catch (modelError) {
      // Fail CLOSED — never proceed with unverified images
      console.warn('[verify-car-image] Gemini unavailable, rejecting image', modelError);
      return ok({
        is_car: false,
        reason: 'Could not verify this image. Please upload a clear photo of your vehicle.',
      });
    }
  } catch (error) {
    console.error('[verify-car-image] error', error);
    return fail('Invalid request body', 'INVALID_JSON', 400);
  }
});
