/** User-drawn damage ellipse — all values 0–100 (% of photo container). */
export interface DamageRegion {
  id: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

const clampPct = (v: number) => Math.max(0, Math.min(100, v));

/** Convert ellipse regions to normalized polygons for the AI (0–1 coordinates). */
export const regionsToPolygons = (regions: DamageRegion[]): [number, number][][] =>
  regions.map((r) => {
    const steps = 12;
    return Array.from({ length: steps }, (_, i) => {
      const a = (i / steps) * 2 * Math.PI;
      return [
        clampPct(r.cx + r.rx * Math.cos(a)) / 100,
        clampPct(r.cy + r.ry * Math.sin(a)) / 100,
      ] as [number, number];
    });
  });

/** Flatten all photo regions into one polygon list for analyze-dents-secure. */
export const allRegionsToPolygons = (byPhoto: DamageRegion[][]): [number, number][][] =>
  byPhoto.flatMap((regions) => regionsToPolygons(regions));

/** Build a region from drag start/end in container % coordinates. */
export const regionFromDrag = (
  id: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  minSize = 4,
): DamageRegion | null => {
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);
  if (width < minSize || height < minSize) return null;
  return {
    id,
    cx: clampPct(left + width / 2),
    cy: clampPct(top + height / 2),
    rx: width / 2,
    ry: height / 2,
  };
};

/** Pointer position → container % (0–100). */
export const pointerToPct = (
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { x: number; y: number } => ({
  x: clampPct(((clientX - rect.left) / rect.width) * 100),
  y: clampPct(((clientY - rect.top) / rect.height) * 100),
});
