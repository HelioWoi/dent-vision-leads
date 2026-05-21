/**
 * Verify Car Image Edge Function
 *
 * Server-side Gemini API call to verify if an uploaded image contains a car
 * Replaces direct frontend calls with secure backend processing
 *
 * Endpoint: /functions/v1/verify-car-image
 * Method: POST
 * Headers: Authorization: Bearer <token>
 *
 * Body: {
 *   shopId?: string, // Optional, uses first shop if not provided
 *   image: string, // base64 encoded image
 *   imageType: string // MIME type (e.g., "image/jpeg")
 * }
 *
 * Response:
 * - Success: { success: true, data: { is_car: boolean, reason: string } }
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
import { callGeminiAPIWithRetry, GEMINI_FLASH_MODEL } from '../_shared/gemini.ts';
import { verifyCarImageSchema, validateInput, type VerifyCarImageInput } from '../_shared/schemas.ts';

// ========================================================================
// RESPONSE TYPES
// ========================================================================

interface VerifyCarImageResponse {
  is_car: boolean;
  reason: string;
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
    const body = await parseRequestBody<VerifyCarImageInput>(req);
    if (!body) {
      return errorResponse('Invalid request body', 400, ERROR_CODES.INVALID_INPUT);
    }

    // Validate input schema
    const validation = validateInput(verifyCarImageSchema, body);
    if (!validation.success) {
      return errorResponse(validation.error, 400, ERROR_CODES.VALIDATION_FAILED);
    }

    const validatedBody = validation.data;

    // Get Supabase client
    const supabase = getSupabaseClient(auth.token);

    let shopId: string;

    if (auth.user.id === 'demo-user') {
      // Demo/anonymous user - use 'demo' shopId
      shopId = (validatedBody as any).shopId || 'demo';
    } else {
      // Authenticated user - resolve from database
      const resolved = await resolveShopId(auth.user.id, (validatedBody as any).shopId, supabase);
      if (!resolved) {
        return errorResponse('No shop access found', 403, ERROR_CODES.SHOP_ACCESS_DENIED);
      }
      shopId = (resolved as any).shopId;
    }

    // Check quota before making API call (skip for demo users)
    if (auth.user.id !== 'demo-user') {
      const hasQuota = await checkShopQuota(shopId, supabase);
      if (!hasQuota) {
        return errorResponse(
          'Monthly API quota exceeded. Please upgrade your plan or wait until next month.',
          429,
          ERROR_CODES.QUOTA_EXCEEDED
        );
      }
    }

    // Validate base64 image
    const imageData = (validatedBody as any).image;
    if (!imageData || imageData.length < 100) {
      return errorResponse('Invalid or empty image data', 400, ERROR_CODES.INVALID_INPUT);
    }

    // Build prompt for Gemini
    const prompt = `Analyze this image and determine if it contains a car or vehicle.
Respond ONLY with a JSON object in this exact format:
{
  "is_car": true or false,
  "reason": "brief explanation"
}

Rules:
- Return is_car: true if the image shows any part of a car, truck, van, SUV, motorcycle, or vehicle
- Return is_car: false if the image shows something else (person, building, landscape, etc.)
- Be lenient - even partial car views or damaged vehicles should return true
- The reason should be brief (one sentence maximum)`;

    // Call Gemini API with retry logic (middleware v2 - anonymous auth fix)
    console.log('[VERIFY-CAR-IMAGE] About to call Gemini API');
    console.log('[VERIFY-CAR-IMAGE] Model:', GEMINI_FLASH_MODEL);
    console.log('[VERIFY-CAR-IMAGE] Image data length:', imageData.length);
    
    const result = await callGeminiAPIWithRetry({
      model: GEMINI_FLASH_MODEL,
      prompt,
      images: [{ mimeType: (validatedBody as any).imageType, data: imageData }],
      temperature: 0.1,
      responseMimeType: 'application/json',
    });
    
    console.log('[VERIFY-CAR-IMAGE] Gemini API call completed');

    // Parse JSON response
    let verificationResult: VerifyCarImageResponse;
    try {
      verificationResult = JSON.parse(result.text);
    } catch (parseError) {
      // If JSON parsing fails, try to extract boolean from text
      const lowerText = result.text.toLowerCase();
      const isCar = lowerText.includes('true') || lowerText.includes('"is_car":true');
      verificationResult = {
        is_car: isCar,
        reason: result.text.substring(0, 200) || 'Could not parse response',
      };
    }

    // Log API usage
    const responseTime = Date.now() - startTime;
    await logGeminiAPICall(supabase, {
      shop_id: shopId,
      model_used: GEMINI_FLASH_MODEL,
      token_count_input: result.promptTokens || 0,
      token_count_output: result.responseTokens || 0,
      response_time_ms: responseTime,
      error_code: null,
    });

    return successResponse(verificationResult);
  } catch (error: any) {
    console.error('Error in verify-car-image:', error);

    // Handle quota errors specifically
    if (error.message?.includes('quota') || error.message?.includes('429')) {
      return errorResponse(
        'High demand - please try again in a few moments.',
        429,
        ERROR_CODES.QUOTA_EXCEEDED
      );
    }

    const errorMessage = error.message || 'Failed to verify car image';
    return errorResponse(errorMessage, 500, ERROR_CODES.GEMINI_API_ERROR);
  }
});
