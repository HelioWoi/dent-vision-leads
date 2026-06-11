/** Shared non-vehicle subject detection for verify + analyze edge functions. */
export const NON_VEHICLE_SUBJECT_RE =
  /\b(screenshot|screen capture|screen shot|ui interface|user interface|website|web page|webpage|document|spreadsheet|excel|google sheet|dashboard|project plan|project phase|task list|task board|kanban|notion|table|chart|graph|progress bar|status report|invoice|receipt|logo design|illustration|mockup|3d render|presentation|slide deck|app screen|software|monitor|desktop|phone screen|tablet screen|id card|credit card|interior cabin|steering wheel|engine bay|undercarriage|food|animal|furniture|person|human face|selfie|text document|pdf|form)\b/i;

export const isNonVehicleSubject = (subject?: string): boolean =>
  !!subject && NON_VEHICLE_SUBJECT_RE.test(subject.toLowerCase());

export const isVehicleImageAccepted = (input: {
  isValid?: boolean;
  isCar?: boolean;
  detectedSubject?: string;
}): { accepted: boolean; reason: string } => {
  const subject = String(input.detectedSubject || '');
  if (isNonVehicleSubject(subject)) {
    return {
      accepted: false,
      reason: 'This image appears to be a screenshot, document, or non-vehicle content.',
    };
  }
  const valid = input.isValid ?? input.isCar;
  if (valid !== true) {
    return {
      accepted: false,
      reason: 'Please upload a clear exterior photo of your vehicle showing the damaged panel.',
    };
  }
  return {
    accepted: true,
    reason: 'Image accepted for vehicle damage analysis.',
  };
};
