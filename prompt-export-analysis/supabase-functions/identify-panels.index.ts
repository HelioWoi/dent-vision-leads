/**
 * Identify Panels Edge Function
 *
 * Server-side Gemini API call to identify vehicle panels from images
 * Returns an array of detected panel types
 *
 * Endpoint: /functions/v1/identify-panels
 * Method: POST
 * Headers: Authorization: Bearer <token>
 *
 * Body: {
 *   shopId?: string, // Optional - will use first shop if not provided
 *   images: string[], // base64 encoded images
 *   imageTypes: string[] // MIME types (e.g., ["image/jpeg", "image/png"])
 * }
 *
 * Response:
 * - Success: { success: true, data: { panels: string[] } }
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

// Valid panel types (Australian/British terminology)
const VALID_PANELS = ['bonnet', 'guard', 'doors', 'roof', 'boot', 'bumper', 'cant_rail'];

// ========================================================================
// REQUEST/RESPONSE TYPES
// ========================================================================

interface IdentifyPanelsRequest {
  shopId?: string;
  images: string[]; // base64 encoded
  imageTypes: string[]; // MIME types
}

interface IdentifyPanelsResponse {
  panels: string[]; // Array of panel type strings
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
    const body = await parseRequestBody<IdentifyPanelsRequest>(req);
    if (!body) {
      return errorResponse('Invalid request body', 400, ERROR_CODES.INVALID_INPUT);
    }

    // Validate required fields
    if (!body.images || !Array.isArray(body.images) || body.images.length === 0) {
      return errorResponse(
        'Missing or empty images array',
        400,
        ERROR_CODES.MISSING_REQUIRED_FIELD
      );
    }

    if (!body.imageTypes || !Array.isArray(body.imageTypes) || body.imageTypes.length !== body.images.length) {
      return errorResponse(
        'imageTypes array must match images array length',
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }

    // Validate image types
    for (const imageType of body.imageTypes) {
      if (!imageType.startsWith('image/')) {
        return errorResponse('Invalid image type in imageTypes array', 400, ERROR_CODES.INVALID_INPUT);
      }
    }

    // Validate base64 images
    for (const image of body.images) {
      if (!image || image.length < 100) {
        return errorResponse('Invalid or empty image data in images array', 400, ERROR_CODES.INVALID_INPUT);
      }
    }

    // Get Supabase client
    const supabase = getSupabaseClient(auth.token);

    // Resolve shopId (use 'demo' for demo users)
    let shopId: string;
    if (auth.user.id === 'demo-user') {
      shopId = body.shopId || 'demo';
    } else {
      const resolved = await resolveShopId(supabase, auth.user.id, body.shopId);
      if (!resolved.success) {
        return errorResponse(resolved.error, 400, ERROR_CODES.SHOP_NOT_FOUND);
      }
      shopId = resolved.shopId;
    }

    // Check quota (skip for demo users)
    if (auth.user.id !== 'demo-user') {
      const quotaCheck = await checkShopQuota(supabase, shopId);
      if (!quotaCheck.allowed) {
        return errorResponse(quotaCheck.error || 'Quota exceeded', 429, ERROR_CODES.QUOTA_EXCEEDED);
      }
    }

    // Build prompt for Gemini
    const prompt = `Analyze these vehicle images and identify which body panels are visible.

Respond ONLY with a JSON object in this exact format:
{
  "panels": ["panel1", "panel2", ...]
}

Rules:
- Use Australian/British terminology: 'bonnet', 'guard', 'doors', 'roof', 'boot', 'bumper', 'cant_rail'
- Only return panels that are clearly visible in the images
- Analyze ALL images together to get a complete picture
- Look for distinguishing features:
  - Bonnet: Front hood, typically has a latch or emblem
  - Guard: Front or rear fender/wing panel
  - Doors: Side doors with handles
  - Roof: Top of the vehicle
  - Boot: Rear trunk/luggage compartment
  - Bumper: Front or rear bumper (plastic, at extremities)
  - Cant Rail: Roof rail/pillar area
- Return an array of unique panel names (no duplicates)
- If no panels can be identified, return empty array: {"panels": []}
- Be precise - only include panels you can confidently identify`;

    // Convert images to required format
    const imagesParts = body.images.map((img, i) => ({
      mimeType: body.imageTypes[i] || 'image/jpeg',
      data: img,
    }));

    // Call Gemini API
    const result = await callGeminiAPI({
      model: GEMINI_FLASH_MODEL,
      prompt,
      images: imagesParts,
      temperature: 0.1,
      responseMimeType: 'application/json',
    });

    // Parse JSON response
    let panelsResult: IdentifyPanelsResponse;
    try {
      const parsed = JSON.parse(result.text);

      // Validate and filter panels
      if (!Array.isArray(parsed.panels)) {
        throw new Error('Invalid panels format: expected array');
      }

      // Filter to only valid panel types and remove duplicates
      const validPanels = parsed.panels
        .filter((panel: any) =>
          typeof panel === 'string' &&
          VALID_PANELS.includes(panel.toLowerCase())
        )
        .map((panel: string) => panel.toLowerCase())
        .filter((panel: string, index: number, self: string[]) =>
          self.indexOf(panel) === index
        ); // Remove duplicates

      panelsResult = {
        panels: validPanels,
      };
    } catch (parseError) {
      console.error('Failed to parse panel identification response:', parseError, result.text);
      // Return empty array if parsing fails
      panelsResult = {
        panels: [],
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

    return successResponse(panelsResult);
  } catch (error: any) {
    console.error('Error in identify-panels:', error);

    // Handle quota errors specifically
    if (error.message?.includes('quota') || error.message?.includes('429')) {
      return errorResponse(
        'High demand - please try again in a few moments.',
        429,
        ERROR_CODES.QUOTA_EXCEEDED
      );
    }

    const errorMessage = error.message || 'Failed to identify panels';
    return errorResponse(errorMessage, 500, ERROR_CODES.GEMINI_API_ERROR);
  }
});
