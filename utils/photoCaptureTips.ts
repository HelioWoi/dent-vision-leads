/** Shown during upload + marking — helps users photograph dents accurately. */
export const PHOTO_CAPTURE_TIPS = [
  'Stand at a 30–45° angle to the panel so reflections bend at the dent.',
  'Fill the frame with the dent — close-up panel shots work best for Category 1 and 2.',
  'Use the Angled slot: side light reveals shallow and medium dings better than straight-on.',
  'Mark each dent tightly — circle the reflection warp, not the whole glare or mirrored scenery.',
  'Wide shots are for scale only; for medium dents (Category 2), add a close-up so the bowl shape is clear.',
  'Avoid washing-out the whole panel in direct sun; move slightly until the dent shows as a pinched reflection.',
] as const;

export const PHOTO_SLOT_HINTS = [
  { label: 'Close-up', hint: 'Tight on dent (45° angle)' },
  { label: 'Angled', hint: 'Side light — best for small dings' },
  { label: 'Wide', hint: 'Panel + handle for scale' },
] as const;
