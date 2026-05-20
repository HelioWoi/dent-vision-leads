// =============================================================================
// Root Types — re-exports quote-engine types + adds leads-specific types
// =============================================================================

export * from './packages/quote-engine/src/types';

// ─── Identify Panels ──────────────────────────────────────────────────────────

export interface IdentifyPanelsInput {
  shopId?: string;
  images: string[];
  imageTypes: string[];
}

export interface IdentifyPanelsResponse {
  panels: string[];
}

// ─── Live Scan ────────────────────────────────────────────────────────────────

export interface LiveScanResponse {
  panels: import('./packages/quote-engine/src/types').Panel[];
  summary: import('./packages/quote-engine/src/types').Summary;
  flags: import('./packages/quote-engine/src/types').Flags;
  notes: string;
}

// ─── Rego Lookup ──────────────────────────────────────────────────────────────

export interface RegoLookupResponse {
  rego: string;
  make?: string;
  model?: string;
  year?: number;
  colour?: string;
  body_type?: string;
  state?: string;
}
