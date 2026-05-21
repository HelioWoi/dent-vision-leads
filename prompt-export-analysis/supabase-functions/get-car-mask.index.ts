/**
 * Get Car Mask Edge Function
 *
 * Server-side Gemini API call to generate a polygon mask for the car in an image
 * Returns normalized coordinates [x, y] pairs representing the car outline
 *
 * Endpoint: /functions/v1/get-car-mask
 * Method: POST
 * Headers: Authorization: Bearer <token>
 *
 * Body: {
 *   shopId?: string, // Optional - will use first shop if not provided
 *   image: string, // base64 encoded image
 *   imageType: string // MIME type (e.g., "image/jpeg")
 * }
 *
 * Response:
 * - Success: { success: true, data: { mask: [number, number][] } }
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

// ========================================================================
// REQUEST/RESPONSE TYPES
// ========================================================================

interface GetCarMaskRequest {
  shopId?: string;
  image: string; // base64 encoded
  imageType: string; // MIME type
}

interface GetCarMaskResponse {
  mask: [number, number][]; // Normalized coordinates [x, y] pairs
}

// ========================================================================
// MAIN HANDLER
// ========================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();

  try {
    // Authenticate request (allow anonymous for demo/customer mode)
    const auth = await authenticateRequest(req, { allowAnonymous: true });
    if (!auth) {
      return errorResponse('Authentication required', 401, ERROR_CODES.AUTH_FAILED);
    }

    // Parse request body
    const body = await parseRequestBody<GetCarMaskRequest>(req);
    if (!body) {
      return errorResponse('Invalid request body', 400, ERROR_CODES.INVALID_INPUT);
    }

    // Validate required fields
    if (!body.image || !body.imageType) {
      return errorResponse(
        'Missing required fields: image, imageType',
        400,
        ERROR_CODES.MISSING_REQUIRED_FIELD
      );
    }

    // Validate image type
    if (!body.imageType.startsWith('image/')) {
      return errorResponse('Invalid image type', 400, ERROR_CODES.INVALID_INPUT);
    }

    // Validate base64 image
    if (body.image.length < 100) {
      return errorResponse('Invalid or empty image data', 400, ERROR_CODES.INVALID_INPUT);
    }

    // Get Supabase client
    const supabase = getSupabaseClient(auth.token);

    // Resolve shopId - use 'demo' for demo users, otherwise resolve from DB
    let shopId: string;
    
    if (auth.user.id === 'demo-user') {
      shopId = body.shopId || 'demo';
      console.log('Using demo shopId for anonymous user');
    } else {
      // Resolve shopId (use provided or first accessible shop)
      const resolved = await resolveShopId(auth.user.id, body.shopId, supabase);
      if (!resolved) {
        return errorResponse('No shop access found', 403, ERROR_CODES.SHOP_ACCESS_DENIED);
      }
      shopId = resolved.shopId;

      // Check quota before making API call
      const hasQuota = await checkShopQuota(shopId, supabase);
      if (!hasQuota) {
        return errorResponse(
          'Monthly API quota exceeded. Please upgrade your plan or wait until next month.',
          429,
          ERROR_CODES.QUOTA_EXCEEDED
        );
      }
    }

    // Build prompt for Gemini
    const prompt = `Analyze this image and identify the car/vehicle.
Generate a polygon outline of the car as an array of normalized coordinates.

Respond ONLY with a JSON object in this exact format:
{
  "mask": [[x1, y1], [x2, y2], [x3, y3], ...]
}

Rules:
- Coordinates must be normalized (0.0 to 1.0) where:
  - x = 0.0 is left edge, x = 1.0 is right edge
  - y = 0.0 is top edge, y = 1.0 is bottom edge
- Include enough points to accurately outline the car (minimum 8 points)
- Points should be ordered clockwise or counter-clockwise to form a closed polygon
- If no car is detected, return an empty array: {"mask": []}
- Focus on the main vehicle body, exclude background, people, or other objects
- For partial car views, outline the visible portion`;

    // Call Gemini API
    const result = await callGeminiAPI({
      model: GEMINI_FLASH_MODEL,
      prompt,
      images: [{ mimeType: body.imageType, data: body.image }],
      temperature: 0.1,
      responseMimeType: 'application/json',
    });

    // Parse JSON response
    let maskResult: GetCarMaskResponse;
    try {
      const parsed = JSON.parse(result.text);
      // Validate mask format
      if (!Array.isArray(parsed.mask)) {
        throw new Error('Invalid mask format: expected array');
      }
      // Validate coordinates are [number, number] pairs
      const validMask = parsed.mask.filter((point: any) =>
        Array.isArray(point) &&
        point.length === 2 &&
        typeof point[0] === 'number' &&
        typeof point[1] === 'number' &&
        point[0] >= 0 && point[0] <= 1 &&
        point[1] >= 0 && point[1] <= 1
      );

      maskResult = {
        mask: validMask as [number, number][],
      };
    } catch (parseError) {
      console.error('Failed to parse car mask response:', parseError, result.text);
      // Return empty mask if parsing fails
      maskResult = {
        mask: [],
      };
    }

    // Log API usage
    const responseTime = Date.now() - startTime;
    await logGeminiAPICall(supabase, {
      shop_id: shopId,
      model_used: GEMINI_FLASH_MODEL,
      token_count_input: result.tokenCount?.input || 0,
      token_count_output: result.tokenCount?.output || 0,
      response_time_ms: responseTime,
      error_code: null,
    });

    return successResponse(maskResult);
  } catch (error: any) {
    console.error('Error in get-car-mask:', error);

    // Handle quota errors specifically
    if (error.message?.includes('quota') || error.message?.includes('429')) {
      return errorResponse(
        'High demand - please try again in a few moments.',
        429,
        ERROR_CODES.QUOTA_EXCEEDED
      );
    }

    const errorMessage = error.message || 'Failed to get car mask';
    return errorResponse(errorMessage, 500, ERROR_CODES.GEMINI_API_ERROR);
  }
});
