/**
 * Analyze Live Scan Edge Function
 *
 * Server-side Gemini API orchestration for live camera scan damage analysis.
 * Reuses core logic from analyze-dents-secure but optimised for multi-frame input.
 *
 * Endpoint: /functions/v1/analyze-live-scan
 * Method: POST
 * Headers: Authorization: Bearer <token>
 *
 * Body: {
 *   shopId?: string,
 *   frames: string[],      // base64 encoded images
 *   imageTypes: string[],  // MIME types for each frame
 *   serviceType?: 'pdr' | 'hail'
 * }
 *
 * Response:
 * - Success: { success: true, data: LiveScanResponse }
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
// TYPES
// ========================================================================

interface AnalyzeLiveScanRequest {
  shopId?: string;
  frames: string[];
  imageTypes: string[];
  serviceType?: 'pdr' | 'hail';
}

interface LiveScanResponse {
  damage_location: string;
  size_category: 'Small' | 'Medium' | 'Large';
  confidence: number;
  needs_paint_repair: boolean; // New field to align with photo analysis capabilities
  damage_type: 'pdr' | 'hail' | 'uncertain'; // Type of damage detected
  dent_count_estimate?: number; // Estimated number of dents (for hail detection)
  estimated_cost?: { min: number; max: number } | null; // Pricing estimate based on shop config
}

// ========================================================================
// MAIN HANDLER
// ========================================================================

Deno.serve(async (req: Request) => {
  const cors = handleCORS(req);
  if (cors) return cors;

  const startTime = Date.now();

  try {
    const auth = await authenticateRequest(req, { allowAnonymous: true });
    if (!auth) {
      return errorResponse('Authentication required', 401, ERROR_CODES.AUTH_FAILED);
    }

    const body = await parseRequestBody<AnalyzeLiveScanRequest>(req);
    if (!body) {
      return errorResponse('Invalid request body', 400, ERROR_CODES.INVALID_INPUT);
    }

    if (!body.frames || !Array.isArray(body.frames) || body.frames.length === 0) {
      return errorResponse(
        'Missing or empty frames array',
        400,
        ERROR_CODES.MISSING_REQUIRED_FIELD
      );
    }

    if (
      !body.imageTypes ||
      !Array.isArray(body.imageTypes) ||
      body.imageTypes.length !== body.frames.length
    ) {
      return errorResponse(
        'imageTypes array must match frames array length',
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }

    // Get Supabase client
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

    // Basic validation of frames and types
    for (let i = 0; i < body.frames.length; i++) {
      const frame = body.frames[i];
      const type = body.imageTypes[i];
      if (!type.startsWith('image/')) {
        return errorResponse('Invalid image type in imageTypes', 400, ERROR_CODES.INVALID_INPUT);
      }
      if (!frame || frame.length < 100) {
        return errorResponse('Invalid or empty frame data', 400, ERROR_CODES.INVALID_INPUT);
      }
    }

    const serviceType = body.serviceType || 'pdr';

    // Fetch shop's AdminConfig for pricing rules
    // Use the authenticated user's ID directly (they are the shop admin)
    let adminConfig = null;
    const { data: configData, error: configError } = await supabase
      .from('admin_configs')
      .select('*')
      .eq('user_id', auth.user.id)
      .single();

    console.log('Admin config query:', {
      userId: auth.user.id,
      found: !!configData,
      error: configError?.message
    });

    if (!configError && configData) {
      adminConfig = configData;
      const config = configData.config || {};
      console.log('Admin config loaded:', {
        hasConfig: !!config,
        hasPricingRules: !!config.pricingRules,
        rulesCount: config.pricingRules?.length || 0,
        pricingMargin: config.pricingMargin
      });
    } else {
      // Use default pricing rules for anonymous/demo users
      console.log('No admin config found, using default pricing rules');
      adminConfig = {
        config: {
          pricingRules: [
            { range: '0-30mm', price: 150 },    // Cat.1
            { range: '31-60mm', price: 180 },   // Cat.2
            { range: '61-90mm', price: 212 },   // Cat.3
            { range: '91-160mm', price: 240 },  // Cat.4
            { range: '161-260mm', price: 321 }, // Cat.5
            { range: '261-400mm', price: 428 }, // Cat.6
            { range: '401-600mm', price: 535 }, // Cat.7
          ],
          pricingMargin: 22
        }
      };
    }

    // Build prompt for Gemini
    const prompt = `You are an expert automotive damage assessment AI.

You will be given multiple frames captured from a live camera scan over a vehicle.
Your task is to:
1. Determine the primary location of visible damage on the vehicle (e.g. "front left guard", "rear bumper", "roof", etc.)
2. Categorize the approximate overall size of the damaged area as "Small", "Medium", or "Large"
3. Provide an overall confidence score between 0 and 1.
4. Assess if the damage requires paint repair (scratches through clear coat, paint chips, rust, cracked paint, etc.) and set needs_paint_repair to true/false.

Respond ONLY with a JSON object in this exact format:
{
  "damage_location": "short human-readable description",
  "size_category": "Small" | "Medium" | "Large",
  "confidence": 0.0-1.0,
  "needs_paint_repair": true | false
}

Rules:
- Consider all frames together when determining the location and size.
- Be conservative with confidence if frames are blurry, dark, or inconsistent.
- Set needs_paint_repair to true if you see scratches through paint, chips, rust, or cracked paint.
- Set needs_paint_repair to false for dents without paint damage (PDR-compatible).
- If you cannot confidently determine damage, use:
  {
    "damage_location": "unknown",
    "size_category": "Small",
    "confidence": 0.3,
    "needs_paint_repair": false
  }`;

    // Convert frames to required format
    const framesParts = body.frames.map((frame, i) => ({
      mimeType: body.imageTypes[i] || 'image/jpeg',
      data: frame,
    }));

    // Call Gemini API
    const result = await callGeminiAPI({
      model: GEMINI_FLASH_MODEL,
      prompt,
      images: framesParts,
      temperature: 0.2,
      responseMimeType: 'application/json',
    });

    // Parse JSON response
    let scanResult: LiveScanResponse = {
      damage_location: 'unknown',
      size_category: 'Small',
      confidence: 0.3,
      needs_paint_repair: false,
      damage_type: 'uncertain',
      estimated_cost: null,
    };

    try {
      const json = JSON.parse(result.text);
      if (json && typeof json === 'object') {
        scanResult = {
          damage_location: json.damage_location || 'unknown',
          size_category:
            json.size_category === 'Medium' || json.size_category === 'Large'
              ? json.size_category
              : 'Small',
          confidence:
            typeof json.confidence === 'number'
              ? Math.min(Math.max(json.confidence, 0), 1)
              : 0.3,
          needs_paint_repair: json.needs_paint_repair === true,
          damage_type: json.damage_type === 'hail' || json.damage_type === 'pdr' ? json.damage_type : 'uncertain',
          dent_count_estimate: typeof json.dent_count_estimate === 'number' ? json.dent_count_estimate : undefined,
          estimated_cost: null,
        };

        // Calculate pricing if we have admin config and confidence is sufficient
        console.log('Pricing calculation check:', {
          hasAdminConfig: !!adminConfig,
          confidence: scanResult.confidence,
          confidenceThreshold: 0.5,
          needsPaintRepair: scanResult.needs_paint_repair,
          sizeCategory: scanResult.size_category
        });

        if (adminConfig && scanResult.confidence >= 0.4 && !scanResult.needs_paint_repair) {
          // AdminConfig stores settings in 'config' JSONB field
          const config = adminConfig.config || {};
          const pricingRules = config.pricingRules || [];
          const pricingMargin = config.pricingMargin || 0;

          console.log('Admin config loaded:', {
            hasPricingRules: pricingRules.length > 0,
            rulesCount: pricingRules.length,
            margin: pricingMargin,
            firstRule: pricingRules[0]
          });

          // Map size category to pricing rule
          let basePrice = 0;
          const sizeCategory = scanResult.size_category;

          // Find matching pricing rule based on size category
          // Map Live Scan size categories to pricing rule ranges (aligned with Upload/Camera)
          // Small = Cat.1 (0-30mm), Medium = Cat.3 (61-90mm), Large = Cat.4 (91-160mm)
          // Note: Cat.5+ reserved for very large dents detected with precise measurements
          let matchingRule;
          if (sizeCategory === 'Small') {
            // Use first rule (0-30mm) for small dents - Cat.1
            matchingRule = pricingRules[0];
          } else if (sizeCategory === 'Medium') {
            // Use third rule (61-90mm) for medium dents - Cat.3
            matchingRule = pricingRules[2] || pricingRules[1] || pricingRules[0];
          } else if (sizeCategory === 'Large') {
            // Use fourth rule (91-160mm) for large dents - Cat.4
            // This aligns better with Upload/Camera which typically detect Cat.3-4 for visible dents
            matchingRule = pricingRules[3] || pricingRules[2] || pricingRules[1] || pricingRules[0];
          }

          console.log('Matching rule:', matchingRule);

          if (matchingRule) {
            basePrice = matchingRule.price || 0;
            const withMargin = Math.round(basePrice * (1 + pricingMargin / 100));
            
            // Add some variance for estimate range (±10%)
            const minPrice = Math.round(withMargin * 0.9);
            const maxPrice = Math.round(withMargin * 1.1);

            scanResult.estimated_cost = {
              min: minPrice,
              max: maxPrice,
            };

            console.log('Pricing calculated:', scanResult.estimated_cost);
          } else {
            console.log('No matching pricing rule found for size:', sizeCategory);
          }
        } else {
          console.log('Pricing calculation skipped - conditions not met');
        }
      }
    } catch (parseError) {
      console.error('Failed to parse live scan response:', parseError, result.text);
      // Use defaults already set
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

    return successResponse<LiveScanResponse>(scanResult);
  } catch (error: any) {
    console.error('Error in analyze-live-scan:', error);

    // Handle quota errors specifically
    if (error.message?.includes('quota') || error.message?.includes('429')) {
      return errorResponse(
        'High demand - please try again in a few moments.',
        429,
        ERROR_CODES.QUOTA_EXCEEDED
      );
    }

    const message = error.message || 'Failed to analyze live scan';
    return errorResponse(message, 500, ERROR_CODES.GEMINI_API_ERROR);
  }
});
