/** Shared non-vehicle subject detection for verify + analyze edge functions. */
export const NON_VEHICLE_SUBJECT_RE =
  /\b(screenshot|screen capture|screen shot|ui interface|user interface|website|web page|webpage|document|spreadsheet|excel|google sheet|dashboard|project plan|project phase|task list|task board|kanban|notion|progress bar|status report|invoice|receipt|logo design|illustration|mockup|3d render|presentation|slide deck|app screen|software|monitor|desktop|phone screen|tablet screen|id card|credit card|interior cabin|steering wheel|engine bay|undercarriage|food|animal|furniture|text document|pdf)\b/i;

/** If the subject mentions vehicle bodywork, accept even when reflections/people appear in paint. */
export const VEHICLE_POSITIVE_SUBJECT_RE =
  /\b(car|vehicle|automobile|auto|door panel|car door|vehicle door|bonnet|hood|boot|trunk|fender|quarter panel|guard|bumper|roof|body panel|bodywork|panel gap|door handle|metallic paint|gloss paint|car paint|dent|ding|scratch|crease|pdr|exterior panel)\b/i;

export const VERIFY_VEHICLE_PROMPT = [
  'You verify photos for a PDR (Paintless Dent Repair) automotive damage app.',
  'ACCEPT (is_valid=true) when the photo shows vehicle EXTERIOR paint, metal, or bodywork — including:',
  '- Close-ups where ONLY a door/panel surface is visible (handle, panel gap, metallic paint, dent, crease)',
  '- Tight macro shots of dents, creases, or scratches on automotive paint',
  '- Photos where a person or building appears only as a REFLECTION on glossy car paint',
  '- Small door dings visible as reflection distortion on panel paint',
  'REJECT (is_valid=false) ONLY when the image clearly has NO automotive surface:',
  '- Browser chrome, app UI, buttons, menus, or webpage layout dominates the image',
  '- Spreadsheets, documents, presentations, or unrelated objects with no car paint/metal',
  '- Completely blurry/dark images where no panel or paint is visible',
  'If glossy automotive paint, metal panel, or body damage is visible, ALWAYS set is_valid=true.',
  'Do NOT reject close-up car panel photos as screenshots — filename or crop does not matter.',
  'In detected_subject, describe the vehicle part seen (e.g. "car door panel with vertical crease dent").',
  'Respond ONLY with JSON: {"is_valid": boolean, "is_car": boolean, "reason": string, "detected_subject": string}.',
].join('\n');

export const isNonVehicleSubject = (subject?: string): boolean => {
  if (!subject) return false;
  const s = subject.toLowerCase();
  if (VEHICLE_POSITIVE_SUBJECT_RE.test(s)) return false;
  return NON_VEHICLE_SUBJECT_RE.test(s);
};

export const isVehicleImageAccepted = (input: {
  isValid?: boolean;
  isCar?: boolean;
  detectedSubject?: string;
}): { accepted: boolean; reason: string } => {
  const subject = String(input.detectedSubject || '');

  if (VEHICLE_POSITIVE_SUBJECT_RE.test(subject)) {
    return {
      accepted: true,
      reason: 'Vehicle exterior panel detected.',
    };
  }

  if (isNonVehicleSubject(subject)) {
    return {
      accepted: false,
      reason: 'This image appears to be a screenshot, document, or non-vehicle content.',
    };
  }

  const valid = input.isValid ?? input.isCar;
  if (valid === true) {
    return {
      accepted: true,
      reason: 'Image accepted for vehicle damage analysis.',
    };
  }

  if (valid === false) {
    return {
      accepted: false,
      reason: 'Please upload a clear exterior photo of your vehicle showing the damaged panel.',
    };
  }

  return {
    accepted: false,
    reason: 'Please upload a clear exterior photo of your vehicle showing the damaged panel.',
  };
};
