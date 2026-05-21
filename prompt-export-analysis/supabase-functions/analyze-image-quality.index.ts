/**
 * Analyze Image Quality Edge Function
 *
 * Optional server-side AI quality analysis to complement the client-side
 * heuristics in imageQualityService.ts.
 *
 * Endpoint: /functions/v1/analyze-image-quality
 * Method: POST
 * Headers: Authorization: Bearer <token>
 *
 * Body: {
 *   shopId?: string,
 *   image: string,
 *   imageType: string
 * }
 *
 * Response:
 * - Success: { success: true, data: ImageQualityFeedback }
 * - Error: { success: false, error: string, code: string }
 */

import {
  authenticateRequest,
  getSupabaseClient,
  successResponse,
  errorResponse,
  handleCORS,
  parseRequestBody,
  logGeminiAPICall,
  resolveShopId,
  checkShopQuota,
  ERROR_CODES,
} from '../_shared/middleware.ts';
import { callGeminiAPI, GEMINI_FLASH_MODEL } from '../_shared/gemini.ts';

interface AnalyzeImageQualityRequest {
  shopId?: string;
  image: string;
  imageType: string;
}

interface ImageQualityFeedback {
  isGoodQuality: boolean;
  issues: {
    isBlurry?: boolean;
    isDark?: boolean;
    isBright?: boolean;
    isLowContrast?: boolean;
  };
  suggestions: string[];
}

Deno.serve(async (req: Request) => {
  const cors = handleCORS(req);
  if (cors) return cors;

  const startTime = Date.now();

  try {
    const auth = await authenticateRequest(req, { allowAnonymous: true });
    if (!auth) {
      return errorResponse('Authentication required', 401, ERROR_CODES.AUTH_FAILED);
    }

    const body = await parseRequestBody<AnalyzeImageQualityRequest>(req);
    if (!body || !body.image || !body.imageType) {
      return errorResponse('Missing required fields', 400, ERROR_CODES.MISSING_REQUIRED_FIELD);
    }

    if (!body.imageType.startsWith('image/')) {
      return errorResponse('Invalid image type', 400, ERROR_CODES.INVALID_INPUT);
    }

    const supabase = getSupabaseClient(auth.token);

    // Resolve shopId (use provided or first accessible shop)
    const resolved = await resolveShopId(auth.user.id, body.shopId, supabase);
    if (!resolved) {
      return errorResponse('No shop access found', 403, ERROR_CODES.SHOP_ACCESS_DENIED);
    }

    const { shopId } = resolved;

    // Check quota before making API call
    const hasQuota = await checkShopQuota(shopId, supabase);
    if (!hasQuota) {
      return errorResponse(
        'Monthly API quota exceeded. Please upgrade your plan or wait until next month.',
        429,
        ERROR_CODES.QUOTA_EXCEEDED
      );
    }

    const prompt = `Analyze this vehicle damage photo ONLY for technical image quality.

You must return JSON in this exact format:
{
  "isGoodQuality": boolean,
  "issues": {
    "isBlurry"?: boolean,
    "isDark"?: boolean,
    "isBright"?: boolean,
    "isLowContrast"?: boolean
  },
  "suggestions": string[]
}

Rules:
- Focus only on blur, lighting, and contrast issues.
- If multiple issues exist, set multiple flags to true.
- suggestions should be concrete, short tips for retaking the photo.`;

    // Call Gemini API
    const result = await callGeminiAPI({
      model: GEMINI_FLASH_MODEL,
      prompt,
      images: [{ mimeType: body.imageType, data: body.image }],
      temperature: 0.1,
      responseMimeType: 'application/json',
    });

    // Parse JSON response
    let feedback: ImageQualityFeedback = {
      isGoodQuality: true,
      issues: {},
      suggestions: [],
    };

    try {
      const parsed = JSON.parse(result.text);
      feedback = {
        isGoodQuality:
          typeof parsed.isGoodQuality === 'boolean' ? parsed.isGoodQuality : true,
        issues: parsed.issues || {},
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    } catch (err) {
      console.error('Failed to parse image quality response:', err, result.text);
    }

    // Log API usage
    const responseTime = Date.now() - startTime;
    await logGeminiAPICall(supabase, {
      shop_id: shopId,
      model_used: GEMINI_FLASH_MODEL,
      token_count_input: result.tokenCount.input,
      token_count_output: result.tokenCount.output,
      response_time_ms: responseTime,
      error_code: null,
    });

    return successResponse<ImageQualityFeedback>(feedback);
  } catch (error: any) {
    console.error('Error in analyze-image-quality:', error);

    // Handle quota errors specifically
    if (error.message?.includes('quota') || error.message?.includes('429')) {
      return errorResponse(
        'High demand - please try again in a few moments.',
        429,
        ERROR_CODES.QUOTA_EXCEEDED
      );
    }

    const message = error.message || 'Failed to analyze image quality';
    return errorResponse(message, 500, ERROR_CODES.GEMINI_API_ERROR);
  }
});
