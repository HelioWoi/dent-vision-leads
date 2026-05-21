/**
 * Edge Function Service
 *
 * Provides frontend interface for calling Supabase Edge Functions
 * Replaces direct API calls with secure backend calls
 *
 * Task Group 9: Frontend Integration - Complete Edge Function wrapper
 */

import { supabase } from './supabaseClient';
import { DentAnalysisResponse, PanelType, IdentifyPanelsInput, IdentifyPanelsResponse } from '../types';

// ========================================================================
// CONFIGURATION
// ========================================================================

const envBag = (import.meta as any).env || {};

const EDGE_FUNCTION_BASE_URL = envBag.VITE_SUPABASE_URL
  ? `${envBag.VITE_SUPABASE_URL}/functions/v1`
  : 'http://127.0.0.1:54321/functions/v1';

// ========================================================================
// HELPER: Get Auth Token
// ========================================================================

const getAuthToken = async (): Promise<string | null> => {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    console.error('Failed to get auth session:', error);
    return null;
  }

  return session.access_token;
};

// ========================================================================
// HELPER: Refresh Session Token
// ========================================================================

/**
 * Attempts to refresh the authentication session
 * Call this when you receive a 401 Unauthorized response
 */
const refreshSession = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.auth.refreshSession();

    if (error || !data.session) {
      console.error('Failed to refresh session:', error);
      return false;
    }

    console.log('✅ Session refreshed successfully');
    return true;
  } catch (error) {
    console.error('Error refreshing session:', error);
    return false;
  }
};

// ========================================================================
// HELPER: Call Edge Function
// ========================================================================

export interface EdgeFunctionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

const callEdgeFunction = async <T>(
  functionName: string,
  body?: any,
  options?: { retryOn401?: boolean; allowAnonymous?: boolean }
): Promise<EdgeFunctionResponse<T>> => {
  const { retryOn401 = true, allowAnonymous = false } = options || {};

  try {
    console.log(`[EDGE FUNCTION ${Date.now()}] Starting callEdgeFunction`, { functionName, allowAnonymous });
    
    // For anonymous calls, skip token retrieval entirely
    let token: string | null = null;
    
    if (!allowAnonymous) {
      token = await getAuthToken();
      
      // If no token and anonymous not allowed, return error
      if (!token) {
        return {
          success: false,
          error: 'Authentication required. Please log in.',
          code: 'AUTH_REQUIRED',
        };
      }
    } else {
      console.log('[EDGE FUNCTION] ✅ allowAnonymous=true, skipping getAuthToken()');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // For anonymous calls, send anon key as Bearer token to satisfy Edge Functions runtime
    if (allowAnonymous && !token) {
      const anonKey = envBag.VITE_SUPABASE_ANON_KEY;
      console.log('[EDGE FUNCTION] Checking VITE_SUPABASE_ANON_KEY:', {
        exists: !!anonKey,
        length: anonKey?.length,
        prefix: anonKey?.substring(0, 20),
      });
      if (anonKey) {
        headers['Authorization'] = `Bearer ${anonKey}`;
        headers['apikey'] = anonKey;
        console.log(`[EDGE FUNCTION] Anonymous call to ${functionName} with anon key as Bearer token`);
      } else {
        console.error('[EDGE FUNCTION] ❌ CRITICAL: No VITE_SUPABASE_ANON_KEY found for anonymous call');
        console.error('[EDGE FUNCTION] import.meta.env:', Object.keys(envBag));
      }
    } else if (token) {
      // For authenticated calls, send Authorization header
      headers['Authorization'] = `Bearer ${token}`;
      console.log(`[EDGE FUNCTION] Authenticated call to ${functionName}`);
    }

    console.log(`[EDGE FUNCTION] Calling ${EDGE_FUNCTION_BASE_URL}/${functionName}`, {
      hasApiKey: !!headers['apikey'],
      hasAuth: !!headers['Authorization'],
      allowAnonymous,
    });

    // Create AbortController for timeout (90 seconds - show friendly retry message if exceeded)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds

    let response;
    try {
      response = await fetch(`${EDGE_FUNCTION_BASE_URL}/${functionName}`, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('[EDGE FUNCTION] Request timeout after 90 seconds');
        return {
          success: false,
          error: 'Analysis is taking longer than expected. This can happen with complex images. Please try again - it usually works on the second attempt!',
          code: 'TIMEOUT',
        };
      }
      throw fetchError; // Re-throw other errors to outer catch
    }

    console.log(`[EDGE FUNCTION] Response status: ${response.status}`);

    // Handle 401 Unauthorized - try to refresh token (but not for anonymous calls)
    if (response.status === 401 && retryOn401 && !allowAnonymous) {
      console.warn('Received 401, attempting to refresh session...');
      const refreshed = await refreshSession();

      if (refreshed) {
        // Retry the request with new token
        return callEdgeFunction(functionName, body, { retryOn401: false, allowAnonymous: false });
      }

      // Refresh failed - user needs to log in again
      return {
        success: false,
        error: 'Your session has expired. Please log in again.',
        code: 'SESSION_EXPIRED',
      };
    }
    
    // For anonymous calls with 401, return auth error immediately
    if (response.status === 401 && allowAnonymous) {
      return {
        success: false,
        error: 'Anonymous request rejected. Edge Function may require authentication.',
        code: 'AUTH_REQUIRED',
      };
    }

    const data = await response.json();
    
    console.log(`[EDGE FUNCTION] Response data:`, data);

    if (!response.ok) {
      console.error(`[EDGE FUNCTION] Error response:`, {
        status: response.status,
        error: data.error,
        code: data.code,
        fullData: data,
      });
      return {
        success: false,
        error: data.error || `Request failed with status ${response.status}`,
        code: data.code || 'REQUEST_FAILED',
      };
    }

    return data;
  } catch (error: any) {
    console.error(`Error calling Edge Function ${functionName}:`, error);
    return {
      success: false,
      error: error.message || 'Network error occurred',
      code: 'NETWORK_ERROR',
    };
  }
};

/**
 * Generic Edge Function caller with automatic token refresh
 * Use this for any Edge Function call
 * Allows anonymous calls by default for demo/customer mode
 */
export const callFunction = async <T>(
  functionName: string,
  body?: any,
  options?: { allowAnonymous?: boolean }
): Promise<EdgeFunctionResponse<T>> => {
  return callEdgeFunction<T>(functionName, body, { ...options, allowAnonymous: options?.allowAnonymous ?? true });
};

// Export for compatibility
export const edgeFunctionService = {
  callFunction,
};

// ========================================================================
// AUTH VERIFY
// ========================================================================

export interface UserShop {
  id: string;
  name: string;
  role: 'shop_admin' | 'lead_tech' | 'technician' | 'read_only';
  subscription_status: string;
  logo_url?: string;
}

export interface AuthVerifyResponse {
  user: {
    id: string;
    email?: string;
  };
  shops: UserShop[];
}

/**
 * Verifies authentication and returns user with accessible shops
 */
export const verifyAuth = async (): Promise<AuthVerifyResponse | null> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      console.warn('No auth token available');
      return null;
    }

    const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/auth-verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('Auth verification failed:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data.success) {
      console.error('Auth verification error:', data.error);
      return null;
    }

    return data.data as AuthVerifyResponse;
  } catch (error) {
    console.error('Error verifying auth:', error);
    return null;
  }
};

// ========================================================================
// ANALYZE DENTS SECURE
// ========================================================================

export interface AnalyzeDentsInput {
  shopId: string;
  images: string[]; // base64 encoded
  vehicleDetails: {
    vehicleType: string;
    panel: PanelType[];
    material: string;
    lighting: string;
  };
  serviceType?: 'pdr' | 'hail';
  clarificationImage?: string;
  userPolygons?: [number, number][][];
}

/**
 * Analyzes dents using secure server-side Gemini API call
 * Replaces direct geminiService.analyzeDents() calls
 */
export const analyzeDentsSecure = async (
  input: AnalyzeDentsInput
): Promise<DentAnalysisResponse> => {
  const response = await callEdgeFunction<DentAnalysisResponse>(
    'analyze-dents-secure',
    input,
    { allowAnonymous: true }
  );

  if (!response.success || !response.data) {
    const err: any = new Error(response.error || 'Analysis failed');
    err.code = response.code;
    throw err;
  }

  return response.data;
};

// ... (rest of the code remains the same)

/**
 * Identifies vehicle panels from images using secure server-side Gemini API
 * Replaces direct geminiService.identifyPanelsFromImages() calls
 */
export const identifyPanels = async (
  input: IdentifyPanelsInput
): Promise<{ panels: string[] }> => {
  const response = await callEdgeFunction<IdentifyPanelsResponse>(
    'identify-panels',
    input,
    { allowAnonymous: true }
  );

  if (!response.success || !response.data) {
    const errorMessage = response.error || 'Panel identification failed';
    throw new Error(errorMessage);
  }

  return { panels: response.data.panels };
};

// ========================================================================
// VERIFY CAR IMAGE
// ========================================================================

export interface VerifyCarImageInput {
  shopId?: string; // Optional - will use first shop if not provided
  image: string; // base64 encoded
  imageType: string; // MIME type
}

export interface VerifyCarImageResponse {
  is_car: boolean;
  reason: string;
}

/**
 * Verifies if an uploaded image contains a car using secure server-side Gemini API
 * Replaces direct geminiService.verifyIsCarImage() calls
 */
export const verifyCarImage = async (
  input: VerifyCarImageInput
): Promise<VerifyCarImageResponse> => {
  const response = await callEdgeFunction<VerifyCarImageResponse>(
    'verify-car-image',
    input,
    { allowAnonymous: true }
  );

  if (!response.success || !response.data) {
    const errorMessage = response.error || 'Image verification failed';
    throw new Error(errorMessage);
  }

  return response.data;
};

// ========================================================================
// HELPER: Convert Files to Base64
// ========================================================================

/**
 * Compresses an image file to reduce size for faster API calls
 * Uses high quality settings to maintain accuracy for AI analysis
 */
const compressImage = (file: File, maxWidth = 1600, quality = 0.85): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Skip compression for small files (under 500KB)
    if (file.size < 500 * 1024) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        console.log(`[IMAGE] Small file, no compression: ${file.name} ${(file.size / 1024).toFixed(0)}KB`);
        resolve(base64);
      };
      reader.onerror = reject;
      return;
    }

    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;
      
      // Scale down if wider than maxWidth
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = compressedDataUrl.split(',')[1];
      const compressedSize = Math.round((base64.length * 3) / 4 / 1024);
      
      console.log(`[IMAGE] Compressed: ${file.name} ${(file.size / 1024).toFixed(0)}KB → ${compressedSize}KB`);
      resolve(base64);
    };

    img.onerror = () => {
      // Fallback to original if compression fails
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        console.log(`[IMAGE] Compression failed, using original: ${file.name}`);
        resolve(base64);
      };
      reader.onerror = reject;
    };

    // Load image from file
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      img.src = reader.result as string;
    };
    reader.onerror = reject;
  });
};

/**
 * Converts File objects to base64 strings for Edge Function transmission
 * Compresses large images to prevent API timeouts
 */
export const filesToBase64 = async (files: File[]): Promise<string[]> => {
  const conversions = files.map((file) => compressImage(file));
  return Promise.all(conversions);
};

// ========================================================================
// ERROR HANDLING
// ========================================================================

/**
 * Converts Edge Function errors to user-friendly messages
 */
export const handleEdgeFunctionError = (error: any): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (error.message) {
    const msg = error.message.toLowerCase();

    if (msg.includes('session has expired') || msg.includes('session_expired')) {
      // Trigger redirect to login
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      return 'Your session has expired. Redirecting to login...';
    }

    if (msg.includes('quota') || msg.includes('429')) {
      return 'High demand detected. The system is automatically retrying. Please wait a moment.';
    }

    if (msg.includes('safety')) {
      return 'Request blocked due to safety filters. Please try different images or angles.';
    }

    if (msg.includes('auth')) {
      return 'Authentication error. Please log in again.';
    }

    if (msg.includes('shop access') || msg.includes('forbidden')) {
      return 'You do not have permission to access this shop.';
    }

    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
};

// ========================================================================
// MIGRATION HELPERS
// ========================================================================

/**
 * Checks if Edge Functions are available
 * Provides fallback messaging for development
 */
export const areEdgeFunctionsAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/auth-verify`, {
      method: 'OPTIONS',
    });
    return response.ok;
  } catch (error) {
    console.warn('Edge Functions not available:', error);
    return false;
  }
};

/**
 * Gets the current shop ID from session/context
 * This should be set after user logs in and selects their shop
 */
export const getCurrentShopId = (): string | null => {
  return sessionStorage.getItem('currentShopId');
};

/**
 * Sets the current shop ID in session
 */
export const setCurrentShopId = (shopId: string): void => {
  sessionStorage.setItem('currentShopId', shopId);
};

/**
 * Clears the current shop context
 */
export const clearCurrentShop = (): void => {
  sessionStorage.removeItem('currentShopId');
};
