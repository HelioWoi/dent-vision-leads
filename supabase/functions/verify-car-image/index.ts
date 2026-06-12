import { corsHeaders, fail, ok } from '../_shared/response.ts';
import { generateGeminiJson } from '../_shared/gemini.ts';
import { generateOpenAIVisionJson, isOpenAIConfigured } from '../_shared/openai.ts';
import {
  VERIFY_VEHICLE_PROMPT,
  isVehicleImageAccepted,
} from '../_shared/imageValidation.ts';

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

const verifyWithModel = async (
  image: string,
  mimeType: string,
): Promise<VerifyCarImageModelResponse> => {
  let lastError: unknown;

  try {
    return await generateGeminiJson<VerifyCarImageModelResponse>(
      VERIFY_VEHICLE_PROMPT,
      [{ base64: image, mimeType }],
    );
  } catch (geminiError) {
    lastError = geminiError;
    console.warn('[verify-car-image] Gemini failed, trying OpenAI', geminiError);
  }

  if (isOpenAIConfigured()) {
    try {
      return await generateOpenAIVisionJson<VerifyCarImageModelResponse>(
        VERIFY_VEHICLE_PROMPT,
        [{ base64: image, mimeType }],
        400,
      );
    } catch (openAIError) {
      lastError = openAIError;
      console.warn('[verify-car-image] OpenAI verify failed', openAIError);
    }
  }

  throw lastError ?? new Error('No verification model available');
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
    const imageType = body.imageType || 'image/jpeg';

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
      const modelResult = await verifyWithModel(image, imageType);
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
      console.warn('[verify-car-image] All verify models failed', modelError);
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
