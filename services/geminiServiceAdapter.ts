/**
 * Gemini Service Adapter
 * 
 * SECURITY: This adapter wraps Edge Function calls to maintain backward compatibility
 * with the old geminiService API while ensuring ALL calls go through secure Edge Functions.
 * 
 * This file provides the SAME API as geminiService.ts but routes everything through
 * edgeFunctionService.ts (which calls Supabase Edge Functions).
 * 
 * NO GEMINI API KEYS are exposed to the frontend.
 */

import { 
  analyzeDentsSecure, 
  verifyCarImage as verifyCarImageEdge,
  identifyPanels as identifyPanelsEdge,
  filesToBase64,
  getCurrentShopId,
  callFunction
} from './edgeFunctionService';
import { 
  DentAnalysisResponse, 
  VehicleType, 
  MaterialType, 
  LightingType, 
  PanelType,
  LiveScanResponse,
  RegoLookupResponse
} from '../types';
import { calculatePanelPricing } from './panelPricingHelper';

// ========================================================================
// SECURITY: Shop Context Helper
// ========================================================================

/**
 * Gets shop ID with fallback for demo/customer mode.
 * Returns 'demo' if no shop context available (for anonymous usage).
 */
const getShopIdOrDemo = (): string => {
  const shopId = getCurrentShopId();
  return shopId || 'demo';
};

// ========================================================================
// TYPES: Chatbot Message Structure
// ========================================================================

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

// ========================================================================
// ANALYZE DENTS - Adapter for old API
// ========================================================================

export const analyzeDents = async (
  files: File[],
  vehicleType: VehicleType,
  material: MaterialType,
  lighting: LightingType,
  panels: PanelType[],
  serviceType: 'pdr' | 'hail' = 'pdr',
  clarificationImage?: File,
  userPolygons?: [number, number][][] | [number, number][][][]
): Promise<DentAnalysisResponse> => {
  const shopId = getShopIdOrDemo();
  
  // Convert files to base64
  const images = await filesToBase64(files);
  const clarificationImageBase64 = clarificationImage 
    ? (await filesToBase64([clarificationImage]))[0] 
    : undefined;
  
  // Flatten polygons if provided - handle both 2D and 3D arrays
  let flatPolygons: [number, number][][] | undefined;
  if (userPolygons && userPolygons.length > 0) {
    // Check structure: 2D = [[x,y], [x,y]], 3D = [[[x,y], [x,y]]]
    const firstElement = userPolygons[0];
    if (Array.isArray(firstElement) && Array.isArray(firstElement[0]) && typeof firstElement[0][0] === 'number') {
      // It's 2D: array of polygons, each polygon is array of points
      flatPolygons = userPolygons as [number, number][][];
    } else {
      // It's 3D: array of groups of polygons - flatten one level
      flatPolygons = (userPolygons as [number, number][][][]).flat();
    }
  }
  
  const result = await analyzeDentsSecure({
    shopId,
    images,
    vehicleDetails: {
      vehicleType,
      panel: panels,
      material,
      lighting
    },
    serviceType,
    clarificationImage: clarificationImageBase64,
    userPolygons: flatPolygons
  });

  // Calculate real pricing for panels (AI returns {min:0, max:0} by design)
  const resultWithPricing = await calculatePanelPricing(result, material, vehicleType);
  
  return resultWithPricing;
};

// ========================================================================
// VERIFY CAR IMAGE - Adapter for old API
// ========================================================================

export const verifyIsCarImage = async (file: File): Promise<{ is_car: boolean; reason: string }> => {
  const shopId = getShopIdOrDemo();
  const base64 = (await filesToBase64([file]))[0];
  
  return verifyCarImageEdge({
    shopId,
    image: base64,
    imageType: file.type
  });
};

// ========================================================================
// IDENTIFY PANELS - Adapter for old API
// ========================================================================

export const identifyPanelsFromImages = async (files: File[]): Promise<{ panels: PanelType[] }> => {
  const shopId = getShopIdOrDemo();
  const images = await filesToBase64(files);
  const imageTypes = files.map(f => f.type);
  
  const result = await identifyPanelsEdge({
    shopId,
    images,
    imageTypes
  });
  
  return { panels: result.panels as PanelType[] };
};

// ========================================================================
// GET CAR MASK - Adapter for old API
// ========================================================================

export const getCarMask = async (file: File): Promise<[number, number][]> => {
  const shopId = getShopIdOrDemo();
  const base64 = (await filesToBase64([file]))[0];
  
  const response = await callFunction<{ mask: [number, number][] }>('get-car-mask', {
    shopId,
    image: base64,
    imageType: file.type
  }, { allowAnonymous: true });
  
  return response.data.mask;
};

// ========================================================================
// LOOKUP REGO - Adapter for old API
// ========================================================================

export const lookupRego = async (rego: string): Promise<RegoLookupResponse> => {
  const shopId = getShopIdOrDemo();
  
  const response = await callFunction<RegoLookupResponse>('lookup-rego', {
    shopId,
    rego
  });
  
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Rego lookup failed');
  }
  
  return response.data;
};

// ========================================================================
// ANALYZE LIVE SCAN - Adapter for old API
// ========================================================================

export const analyzeLiveScan = async (
  frames: File[],
  vehicleType: VehicleType,
  material: MaterialType,
  lighting: LightingType,
  panels: PanelType[],
  serviceType: 'pdr' | 'hail' = 'pdr'
): Promise<LiveScanResponse> => {
  const shopId = getShopIdOrDemo();
  const images = await filesToBase64(frames);
  
  const response = await callFunction<LiveScanResponse>('analyze-live-scan', {
    shopId,
    frames: images,
    vehicleDetails: {
      vehicleType,
      panel: panels,
      material,
      lighting
    },
    serviceType
  });
  
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Live scan analysis failed');
  }
  
  return response.data;
};

// ========================================================================
// CHATBOT - Adapter for old API
// ========================================================================

export const getChatbotResponse = async (history: any[]): Promise<any> => {
  const shopId = getShopIdOrDemo();
  
  // Runtime validation: filter invalid messages and cap history length
  // Accept Gemini's native format with 'parts' array
  const validHistory = history
    .filter(msg => msg.role && msg.parts && Array.isArray(msg.parts))
    .slice(-50); // Cap at 50 messages to prevent abuse
  
  const response = await callFunction<any>('chatbot-assistant', {
    shopId,
    history: validHistory
  });
  
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Chatbot request failed');
  }
  
  return response.data;
};
