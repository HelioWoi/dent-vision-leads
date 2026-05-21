/**
 * Analyze Dents Secure Edge Function
 *
 * Server-side Gemini API orchestration for dent analysis
 * Replaces direct frontend calls with secure backend processing
 *
 * Endpoint: /functions/v1/analyze-dents-secure
 * Method: POST
 * Headers: Authorization: Bearer <token>
 *
 * Body: {
 *   shopId: string,
 *   images: string[], // base64 encoded
 *   vehicleDetails: { vehicleType, panel, material, lighting },
 *   serviceType?: 'pdr' | 'hail',
 *   clarificationImage?: string,
 *   userPolygons?: [number, number][][]
 * }
 *
 * Response:
 * - Success: { success: true, data: DentAnalysisResponse }
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
  validateShopAccess,
  checkShopQuota,
  maskPII,
  ERROR_CODES,
} from '../_shared/middleware.ts';
import { callGeminiAPIWithRetry, GEMINI_PRO_MODEL } from '../_shared/gemini.ts';
import { V1_VISUAL_CLASSIFICATION_SPEC } from '../../../constants-v1-visual-spec.ts';
import { analyzeDentsSchema, validateInput } from '../_shared/schemas.ts';

// ========================================================================
// DENT ANALYSIS LOGIC (Migrated from geminiService.ts)
// ========================================================================

const PANEL_TYPE_OPTIONS = [
  { value: 'bonnet', label: 'Bonnet' },
  { value: 'guard', label: 'Guard' },
  { value: 'doors', label: 'Doors' },
  { value: 'roof', label: 'Roof' },
  { value: 'boot', label: 'Boot' },
  { value: 'bumper', label: 'Bumper' },
  { value: 'cant_rail', label: 'Cant Rail' },
];

// Helper function to build pricing table from rules
const buildPricingTable = (rules: any[], margin: number): string => {
  if (!rules || rules.length === 0) return '';
  
  let table = '\n\n**Pricing Table:**\n';
  table += '| Category | Base Price (AUD) | With Margin (AUD) |\n';
  table += '|----------|------------------|-------------------|\n';
  
  for (const rule of rules) {
    const basePrice = rule.price || 0;
    const withMargin = Math.round(basePrice * (1 + margin / 100));
    table += `| ${rule.range} | $${basePrice} | $${withMargin} |\n`;
  }
  
  return table;
};

const analyzeDents = async (
  images: string[],
  vehicleType: string,
  panels: string[],
  material: string,
  lighting: string,
  serviceType: string,
  shopId: string,
  supabase: any,
  clarificationImage?: string,
  userPolygons?: [number, number][][],
  pricingRules?: any[],
  pricingMargin?: number
): Promise<any> => {
  const allImages = clarificationImage ? [...images, clarificationImage] : images;

  // Simplified system prompt with official V1 Visual Classification Spec
  let systemPrompt = `You are an expert automotive damage assessment AI specializing in Paintless Dent Repair (PDR) analysis.

${V1_VISUAL_CLASSIFICATION_SPEC}

**SPECIAL INSTRUCTIONS FOR HAIL DAMAGE (serviceType: 'hail'):**

When analyzing hail damage:
1. **COUNT TOTAL DENTS** - Scan the entire panel and count every visible hail impact
2. **Set dent_count accurately** - This is the TOTAL number of individual dents you see
3. **Hail pattern:** Multiple small circular impacts (10-50mm), random distribution, high density
4. **Typical hail damage:** 20-100+ dents per affected panel (bonnet, roof, boot)
5. **ONE panel object per physical panel** - e.g., ONE "Bonnet" with all its dents
6. **For dents[] array:** Include a representative sample (10-20 dent objects max) with polygons
   - You don't need to create 100 dent objects - just set dent_count correctly
   - The dents[] array is for visual reference only

**Example for 45 dents on bonnet:**
{
  "panel_name": "Bonnet",
  "dent_count": 45,
  "dents": [
    {size_cm: 1.5, polygon: [[0.2,0.3],[0.21,0.3],...], ...},
    {size_cm: 1.8, polygon: [[0.4,0.5],[0.41,0.5],...], ...},
    ... (10-20 sample dents, not all 45)
  ]
}

CRITICAL - MANDATORY PAINT INSPECTION:
- Paint Chips/Flakes: Missing paint exposing primer/metal (high-contrast spots inside dent)
- Deep Scratches: Penetrating clear coat, catching fingernail
- Scuffs/Transfer: Paint transfer or abrasion marks
- Rust/Corrosion: Orange/brown oxidation = critical fail
- Cracked Paint: Spider-webbing or stress cracks at dent bottom
- If ANY paint damage visible, set pdr_incompatible = true

Provide detailed JSON with:
1. Classify each dent using Categories 1-7 from the Visual Classification Spec above
2. Provide precise polygon coordinates for each damage point
3. For HAIL damage: ensure dent_count reflects EVERY individual impact (not grouped)
4. Use the pricing table provided in the user prompt for cost estimates
5. Flag PDR-incompatible damage (paint damage, deep scratches, rust)
6. Set review_required = true for Category 5+ or when paint damage detected

Respond ONLY with valid JSON matching the expected schema.`;

  // For hail damage, add critical warning at the TOP of the prompt
  if (serviceType === 'hail') {
    systemPrompt = `🌨️ HAIL DAMAGE ANALYSIS - VISUAL DETECTION GUIDE

This vehicle has CONFIRMED HAIL DAMAGE. Your task is to COUNT the hail impact dents.

HOW TO IDENTIFY HAIL DENTS IN THIS IMAGE:
1. Look at the panel surface (hood/bonnet in this case)
2. Hail dents appear as SMALL CIRCULAR SHADOWS or LIGHT DISTORTIONS
3. They are typically 5-25mm in diameter
4. In this image, you can see them as the BUMPY/WAVY texture on the metal surface
5. Each "bump" or "depression" you see is ONE dent - count them ALL

COUNTING METHOD:
- Scan the panel systematically from left to right, top to bottom
- Count every visible impact point
- For dense areas, estimate: if you see 10 dents in a 10cm x 10cm area, and the panel is 50cm x 100cm, that's approximately 50 dents
- Typical hail damage has 30-150 dents per panel

YOUR RESPONSE MUST INCLUDE:
- dent_count: The EXACT number of dents you counted
- Be accurate: if you see 4 dents, report 4. If you see 100, report 100.

${systemPrompt}`;
  }

  const panelLabels = panels
    .map((p) => PANEL_TYPE_OPTIONS.find((opt) => opt.value === p)?.label || p)
    .join(', ');

  let userPrompt = `Analyze this ${vehicleType} for damage on the following panels: ${panelLabels}.
Material: ${material}
Lighting conditions: ${lighting}
Photos provided: ${allImages.length}

**ANALYSIS ONLY - DO NOT CALCULATE PRICES:**
1. Detect and count all dents on each panel
2. Measure dent sizes in millimeters (mm) accurately
3. Set estimated_panel_cost_AUD to {"min": 0, "max": 0} - pricing is calculated by backend
4. Set estimated_total_cost_AUD to {"min": 0, "max": 0} - pricing is calculated by backend
5. Focus on accurate damage detection, not pricing

Provide a detailed damage assessment.`;

  if (userPolygons && userPolygons.length > 0) {
    const polygonsString = JSON.stringify(userPolygons);
    userPrompt += `\n\nUSER-GUIDED ANALYSIS: The user has marked ${userPolygons.length} damage points at: ${polygonsString}.
Analyze each marked area as a confirmed dent.`;
  }

  if (clarificationImage) {
    userPrompt += '\n\nA clarification photo has been provided. Pay special attention to areas indicated.';
  }

  // Response schema (simplified for this implementation)
  const responseSchema = {
    type: 'object',
    properties: {
      panels: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            panel_name: { type: 'string' },
            dent_count: { type: 'integer' },
            scratch_count: { type: 'integer' },
            modifiers: {
              type: 'object',
              properties: {
                aluminium: { type: 'boolean' },
                access_difficulty: { type: 'string' },
                hail_cluster: { type: 'boolean' },
              },
            },
            estimated_panel_cost_AUD: {
              type: 'object',
              properties: {
                min: { type: 'number' },
                max: { type: 'number' },
              },
            },
            dents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  size_cm: { type: 'number' },
                  depth: { type: 'string' },
                  severity_score: { type: 'number' },
                  confidence: { type: 'number' },
                  polygon: {
                    type: 'array',
                    items: {
                      type: 'array',
                      items: { type: 'number' },
                      minItems: 2,
                      maxItems: 2,
                    },
                  },
                },
              },
            },
            scratches: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  length_cm: { type: 'number' },
                  depth: { type: 'string' },
                  severity_score: { type: 'number' },
                  confidence: { type: 'number' },
                  polygon: {
                    type: 'array',
                    items: {
                      type: 'array',
                      items: { type: 'number' },
                      minItems: 2,
                      maxItems: 2,
                    },
                  },
                },
              },
            },
          },
        },
      },
      summary: {
        type: 'object',
        properties: {
          vehicle_type: { type: 'string' },
          total_dents: { type: 'integer' },
          total_scratches: { type: 'integer' },
          overall_severity: { type: 'string' },
          estimated_total_cost_AUD: {
            type: 'object',
            properties: {
              min: { type: 'number' },
              max: { type: 'number' },
            },
          },
          confidence_overall: { type: 'number' },
        },
      },
      flags: {
        type: 'object',
        properties: {
          review_required: { type: 'boolean' },
          possible_reflection: { type: 'boolean' },
          pdr_incompatible: { type: 'boolean' },
        },
      },
      notes: { type: 'string' },
    },
  };

  const model = serviceType === 'hail' ? GEMINI_PRO_MODEL : GEMINI_PRO_MODEL;

  const startTime = Date.now();

  // Convert images to required format for shared utility
  const imagesParts = allImages.map(img => ({
    mimeType: 'image/jpeg',
    data: img,
  }));

  const { text, tokenCount } = await callGeminiAPIWithRetry({
    model,
    prompt: userPrompt,
    images: imagesParts,
    systemInstruction: systemPrompt,
    responseSchema,
    temperature: 0,
    responseMimeType: 'application/json',
  });

  const responseTime = Date.now() - startTime;

  // DEBUG: Log raw Gemini response
  console.log('🔍 GEMINI RAW RESPONSE:', text.substring(0, 1000));
  console.log('🔍 SERVICE TYPE:', serviceType);

  const analysis = JSON.parse(text);

  // DEBUG: Log parsed analysis
  console.log('🔍 PARSED ANALYSIS - panels:', analysis.panels?.length, 'total_dents:', analysis.summary?.total_dents);
  if (analysis.panels) {
    analysis.panels.forEach((p: any) => {
      console.log(`🔍 Panel ${p.panel_name}: dent_count=${p.dent_count}, dents.length=${p.dents?.length || 0}`);
    });
  }

  // Ensure all required fields exist with defaults
  analysis.panels = analysis.panels || [];
  
  // Ensure each panel has all required fields
  analysis.panels = analysis.panels.map((panel: any) => ({
    ...panel,
    panel_name: panel.panel_name || 'Unknown',
    dent_count: panel.dent_count || 0,
    scratch_count: panel.scratch_count || 0,
    estimated_panel_cost_AUD: panel.estimated_panel_cost_AUD || { min: 0, max: 0 },
    dents: panel.dents || [],
    scratches: panel.scratches || [],
    modifiers: panel.modifiers || { aluminium: false, access_difficulty: 'none', hail_cluster: false },
  }));
  
  analysis.summary = analysis.summary || {};
  analysis.summary.vehicle_type = analysis.summary.vehicle_type || 'Unknown';
  analysis.summary.total_dents = analysis.summary.total_dents || 0;
  analysis.summary.total_scratches = analysis.summary.total_scratches || 0;
  analysis.summary.overall_severity = analysis.summary.overall_severity || 'Unknown';
  analysis.summary.estimated_total_cost_AUD = analysis.summary.estimated_total_cost_AUD || { min: 0, max: 0 };
  analysis.summary.confidence_overall = analysis.summary.confidence_overall || 0;
  analysis.summary.base_callout_applied = analysis.summary.base_callout_applied || false;
  analysis.flags = analysis.flags || {};
  analysis.flags.review_required = analysis.flags.review_required || false;
  analysis.flags.possible_reflection = analysis.flags.possible_reflection || false;
  analysis.flags.pdr_incompatible = analysis.flags.pdr_incompatible || false;
  analysis.notes = analysis.notes || '';
  analysis.next_best_captures = analysis.next_best_captures || [];

  // Force hail-specific handling
  if (serviceType === 'hail') {
    analysis.summary.estimated_total_cost_AUD = { min: 0, max: 0 };
    analysis.flags.review_required = true;
    analysis.panels = analysis.panels?.map((p: any) => ({
      ...p,
      estimated_panel_cost_AUD: { min: 0, max: 0 },
    }));
    if (!analysis.notes?.includes('hail')) {
      analysis.notes = 'Preliminary hail damage estimate. A specialist will provide a final quote. ' + (analysis.notes || '');
    }
  }

  return { analysis, tokenCount, responseTime };
};

// ========================================================================
// MAIN HANDLER
// ========================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();
  let shopIdForLogging: string | undefined;

  try {
    // 1. Authenticate request (allow anonymous for demo/customer mode)
    const authContext = await authenticateRequest(req, { allowAnonymous: true });
    if (!authContext) {
      return errorResponse('Authentication required', 401, ERROR_CODES.AUTH_FAILED);
    }

    // 2. Parse and validate request body
    const body = await parseRequestBody(req);
    if (!body) {
      return errorResponse('Invalid request body', 400, ERROR_CODES.INVALID_INPUT);
    }

    const validation = validateInput(analyzeDentsSchema, body);
    if (!validation.success) {
      return errorResponse(validation.error, 400, ERROR_CODES.VALIDATION_FAILED);
    }

    const { shopId, images, vehicleDetails, serviceType, clarificationImage, userPolygons } = validation.data;
    shopIdForLogging = shopId; // Store for error logging

    // 3. Get Supabase client
    const supabase = getSupabaseClient(authContext.token);

    // 3.5. Validate shop access and quota (skip for demo users)
    let shopAccess: any = null;
    
    if (authContext.user.id !== 'demo-user') {
      // Validate shop access
      shopAccess = await validateShopAccess(authContext.user.id, shopId, supabase);

      if (!shopAccess) {
        console.warn('Shop access denied:', maskPII({ userId: authContext.user.id, shopId }));
        return errorResponse('You do not have access to this shop', 403, ERROR_CODES.SHOP_ACCESS_DENIED);
      }

      // Check quota before making API call
      const hasQuota = await checkShopQuota(shopId, supabase);
      if (!hasQuota) {
        return errorResponse(
          'Monthly API quota exceeded. Please upgrade your plan or wait until next month.',
          429,
          ERROR_CODES.QUOTA_EXCEEDED
        );
      }
      
      console.log('Processing dent analysis:', {
        shop: shopAccess.shop_name,
        role: shopAccess.role,
        imageCount: images.length,
        serviceType,
      });
    } else {
      console.log('Processing dent analysis (demo mode):', {
        shopId,
        imageCount: images.length,
        serviceType,
      });
    }

    // 4.5. Load shop pricing configuration
    let pricingRules: any[] = [];
    let pricingMargin = 0;

    if (authContext.user.id === 'demo-user') {
      // Use default pricing rules for demo users
      pricingRules = [
        { range: '0-30mm', price: 118 },
        { range: '31-60mm', price: 180 },
        { range: '61-90mm', price: 258 },
        { range: '91-160mm', price: 293 },
        { range: '161-260mm', price: 392 },
        { range: '261-400mm', price: 490 },
        { range: '400-600mm', price: 680 },
      ];
      pricingMargin = 22;
      console.log('Using default pricing config for demo user');
    } else {
      // Load from database for authenticated users
      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('settings')
        .eq('id', shopId)
        .single();

      if (shopError) {
        console.error('Failed to load shop settings:', shopError);
        return errorResponse('Failed to load shop configuration', 500, ERROR_CODES.INTERNAL_ERROR);
      }

      const settings = shopData?.settings || {};
      pricingRules = settings.pricingRules || [];
      pricingMargin = settings.pricingMargin || 0;

      console.log('Loaded pricing config:', { 
        ruleCount: pricingRules.length, 
        margin: pricingMargin 
      });
    }

    // 5. Call Gemini API with retry logic
    const { analysis, tokenCount, responseTime } = await analyzeDents(
      images,
      vehicleDetails.vehicleType,
      vehicleDetails.panel,
      vehicleDetails.material,
      vehicleDetails.lighting,
      serviceType || 'pdr',
      shopId,
      supabase,
      clarificationImage,
      userPolygons,
      pricingRules,
      pricingMargin
    );

    // 6. Log API usage for quota tracking
    await logGeminiAPICall(supabase, {
      shop_id: shopId,
      model_used: serviceType === 'hail' ? GEMINI_PRO_MODEL : GEMINI_PRO_MODEL,
      token_count_input: tokenCount?.input || 0,
      token_count_output: tokenCount?.output || 0,
      response_time_ms: responseTime,
      error_code: null,
    });

    const totalTime = Date.now() - startTime;
    console.log('Analysis completed:', {
      shop: shopAccess ? maskPII({ name: shopAccess.shop_name }) : 'demo',
      totalTime: `${totalTime}ms`,
      dentCount: analysis.summary?.total_dents || 0,
    });

    // 7. Return analysis results
    return successResponse(analysis);

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    const errorStack = error.stack || '';
    
    console.error('Error in analyze-dents-secure:', {
      message: errorMessage,
      stack: errorStack,
      name: error.name,
    });

    // Log failed API call (using shopId stored before error occurred)
    try {
      if (shopIdForLogging) {
        const supabase = getSupabaseClient();
        await logGeminiAPICall(supabase, {
          shop_id: shopIdForLogging,
          model_used: GEMINI_PRO_MODEL,
          token_count_input: 0,
          token_count_output: 0,
          response_time_ms: Date.now() - startTime,
          error_code: errorMessage?.substring(0, 255) || 'UNKNOWN_ERROR',
        });
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    // Check for API key issues first
    if (errorMessage.includes('GEMINI_API_KEY not configured') || errorMessage.includes('API_KEY')) {
      console.error('❌ GEMINI_API_KEY is not set in edge function environment');
      return errorResponse(
        'API configuration error: GEMINI_API_KEY not set. Please configure the API key in Supabase secrets or .env.local for local development.',
        500,
        ERROR_CODES.GEMINI_API_ERROR
      );
    }

    // User-friendly error messages with standard codes
    if (errorMessage.includes('quota') || errorMessage.includes('429') || errorMessage.includes('resource_exhausted')) {
      return errorResponse(
        'High demand - please try again in a few moments.',
        429,
        ERROR_CODES.QUOTA_EXCEEDED
      );
    }

    if (errorMessage.includes('safety')) {
      return errorResponse(
        'Request blocked due to safety filters. Please try different images.',
        400,
        ERROR_CODES.VALIDATION_FAILED
      );
    }

    // In development, show more details
    const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development' || 
                         Deno.env.get('SUPABASE_URL')?.includes('127.0.0.1') ||
                         Deno.env.get('SUPABASE_URL')?.includes('localhost');
    
    if (isDevelopment) {
      return errorResponse(
        `Development error: ${errorMessage}`,
        500,
        ERROR_CODES.GEMINI_API_ERROR
      );
    }

    return errorResponse(
      'An error occurred during analysis. Please try again.',
      500,
      ERROR_CODES.GEMINI_API_ERROR
    );
  }
});
