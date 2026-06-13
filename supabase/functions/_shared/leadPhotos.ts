type LeadPhotoSource = {
  photo_urls?: unknown;
  photo_url?: string | null;
};

const asUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return undefined;
  return trimmed;
};

/** First publicly reachable photo URL on a lead (for WhatsApp MediaUrl). */
export const pickLeadPhotoUrl = (lead?: LeadPhotoSource | null): string | undefined => {
  if (!lead) return undefined;

  if (Array.isArray(lead.photo_urls)) {
    for (const item of lead.photo_urls) {
      const url = asUrl(item);
      if (url) return url;
    }
  }

  return asUrl(lead.photo_url);
};
