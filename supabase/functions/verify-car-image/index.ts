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
          'You are an image triage agent for a PDR (Paintless Dent Repair) automotive damage system.',
          'Your job is to determine if this image could plausibly be used for vehicle damage assessment.',
          'Be GENEROUS: close-up shots of car panels, doors, paint, dents, scratches, bodywork are ALL valid.',
          'Even if you cannot see the full car, a close-up of a panel, door handle area, or painted metal surface IS valid.',
          'Set is_valid=true for: car door, car panel, bonnet, boot, bumper, fender, bodywork, paint with damage, metal surface with dent or scratch.',
          'Set is_valid=false ONLY for images that are clearly NOT automotive: screenshots, UI, websites, documents, invoices, logos, photos of people, food, animals, furniture, or unrelated objects.',
          'If you are unsure, set is_valid=true. Benefit of the doubt always goes to the user.',
          'Respond ONLY with strict JSON: {"is_valid": boolean, "reason": string, "detected_subject": string}.',
        ].join('\n'),
        [{ base64: image, mimeType: imageType || 'image/jpeg' }],
      );

      const detectedSubject = String(modelResult.detected_subject || '').toLowerCase();

      // Only block content that is clearly and unambiguously NOT a vehicle
      const hardNonVehicle = /\b(screenshot|ui interface|website page|document|invoice|receipt|logo design|illustration|mockup|3d render|photo of person|human face|food|animal|furniture)\b/;
      const isHardBlocked = hardNonVehicle.test(detectedSubject);

      // Accept if model says valid, OR if no hard-block signal found
      const modelSaysValid = modelResult.is_valid ?? modelResult.is_car ?? true;
      const isCar = isHardBlocked ? false : (modelSaysValid !== false);

      console.info('[verify-car-image]', {
        is_car: isCar,
        detected_subject: modelResult.detected_subject,
        model_is_valid: modelResult.is_valid,
        hard_blocked: isHardBlocked,
      });

      return ok({
        is_car: isCar,
        reason: modelResult.reason || (isCar ? 'Image accepted for vehicle damage analysis.' : 'Image does not appear to contain a vehicle exterior.'),
      });
    } catch (modelError) {
      // Fail OPEN — if Gemini is unavailable, let the deep analysis decide
      console.warn('[verify-car-image] Gemini unavailable, failing open', modelError);
      return ok({
        is_car: true,
        reason: 'Could not verify image — proceeding to analysis.',
      });
    }
  } catch (error) {
    console.error('[verify-car-image] error', error);
    return fail('Invalid request body', 'INVALID_JSON', 400);
  }
});
