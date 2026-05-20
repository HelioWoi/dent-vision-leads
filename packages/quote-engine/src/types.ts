// =============================================================================
// Quote Engine — Shared Types
// Self-contained: no imports from partner-specific modules.
// Safe to use in both partner app and leads app.
// =============================================================================

// ─── Vehicle / Material / Panel Enums ────────────────────────────────────────

export enum VehicleType {
  Sedan = 'sedan',
  SUV = 'suv',
  Ute = 'ute',
  Van = 'van',
  Hatch = 'hatch',
}

export enum MaterialType {
  Steel = 'steel',
  Aluminium = 'aluminium',
  Plastic = 'plastic',
  Unknown = 'unknown',
}

export enum LightingType {
  Daylight = 'daylight',
  Workshop = 'workshop',
  Shadowed = 'shadowed',
}

export enum PanelType {
  Bonnet = 'bonnet',
  Guard = 'guard',
  Doors = 'doors',
  Roof = 'roof',
  Boot = 'boot',
  Bumper = 'bumper',
  CantRail = 'cant_rail',
}

// ─── AI Analysis Response Types ───────────────────────────────────────────────

export interface Dent {
  size_cm: number;
  depth: 'Shallow' | 'Medium' | 'Deep';
  severity_score: number;
  confidence: number;
  polygon: [number, number][];
}

export interface Scratch {
  length_cm: number;
  depth: 'Superficial' | 'Paint Chip' | 'Deep';
  severity_score: number;
  confidence: number;
  polygon: [number, number][];
}

export interface Panel {
  panel_name: string;
  dent_count: number;
  scratch_count: number;
  modifiers: {
    aluminium: boolean;
    access_difficulty: 'none' | 'low' | 'medium' | 'high';
    hail_cluster: boolean;
  };
  estimated_panel_cost_AUD: {
    min: number;
    max: number;
  };
  estimated_cost?: {
    min: number;
    max: number;
  };
  dents: Dent[];
  scratches: Scratch[];
  hail_severity?: 'light' | 'moderate' | 'severe' | 'extreme';
  hail_dent_size?: 'up_to_25mm' | 'oversize_25mm';
}

export interface Summary {
  vehicle_type: string;
  total_dents: number;
  total_scratches: number;
  overall_severity: 'Minor' | 'Moderate' | 'Severe' | 'Unknown';
  base_callout_applied: boolean;
  estimated_total_cost_AUD: {
    min: number;
    max: number;
  };
  confidence_overall: number;
  panels?: Panel[];
}

export interface NextCapture {
  tip: string;
  distance_m: string;
  reason: string;
}

export interface Flags {
  review_required: boolean;
  possible_reflection: boolean;
  pdr_incompatible: boolean;
}

export interface DentAnalysisResponse {
  panels: Panel[];
  summary: Summary;
  next_best_captures: NextCapture[];
  flags: Flags;
  notes: string;
  deterministicEstimate?: PricingOutput;
}

// ─── Pricing Types ────────────────────────────────────────────────────────────

export interface PricingRule {
  range: string;
  price: number;
  photo?: string;
  polygons?: [number, number][][];
}

export interface HailPricingRule {
  category: 'light' | 'moderate' | 'severe' | 'extreme';
  dentRange: string;
  sizeCategory: 'up_to_25mm' | 'oversize_25mm';
  basePrice: number;
  aluminumMultiplier: number;
}

export interface PricingOutput {
  priceRange: { min: number; max: number };
  estimatedCost: number;
  tier?: string;
  reasons: string[];
  manualReviewRequired: boolean;
}

// ─── Pricing Engine Input ─────────────────────────────────────────────────────

export interface PricingInput {
  serviceType: 'pdr' | 'hail';
  material?: 'steel' | 'aluminium';
  dentCountTotal: number;
  oversizeDentCount?: number;
  hasPaintNeeded: boolean;
  largestDentSizeMm?: number;
  dominatesPanel?: boolean;
  scaleReferenceUsed?: 'none' | 'door_handle' | 'wheel' | 'coin' | 'unknown';
  overallSeverity?: 'Minor' | 'Moderate' | 'Severe';
  sizeCategory?: 'Small' | 'Medium' | 'Large';
  hailCategory?: 'light' | 'moderate' | 'severe' | 'extreme';
}

// ─── Quote Engine Config (injectable) ────────────────────────────────────────

export interface QuoteEngineConfig {
  pricingRules: PricingRule[];
  pricingMargin: number;
  hailPricingRules: HailPricingRule[];
  hailPricingMargin: number;
}

// ─── Hail Analysis Types ──────────────────────────────────────────────────────

export interface HailPanelAnalysis {
  panel_name: string;
  dent_count: number;
  severity: 'light' | 'moderate' | 'severe' | 'extreme';
  size_category: 'up_to_25mm' | 'oversize_25mm';
  estimated_cost: {
    min: number;
    max: number;
  };
}

export interface HailAnalysisResult {
  panels: HailPanelAnalysis[];
  total_dents: number;
  overall_severity: 'light' | 'moderate' | 'severe' | 'extreme';
  vehicle_type: string;
  material: string;
  estimated_total_cost: {
    min: number;
    max: number;
  };
  confidence: number;
  notes: string;
}
