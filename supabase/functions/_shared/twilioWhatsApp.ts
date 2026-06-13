export const normalizeWhatsAppPhone = (phone: string) => {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0')) return `+61${digits.slice(1)}`;
  if (digits.startsWith('61')) return `+${digits}`;
  return `+${digits}`;
};

export type TwilioWhatsAppResult =
  | { sent: true; sid: string }
  | { sent: false; skipped?: true; reason?: string; code?: number | string };

export const sendTwilioWhatsApp = async (
  toPhone: string,
  body: string,
  options?: { mediaUrl?: string },
): Promise<TwilioWhatsAppResult> => {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM');
  const contentSid = Deno.env.get('TWILIO_WHATSAPP_CONTENT_SID');
  const rawMedia = options?.mediaUrl?.trim();
  const mediaUrl =
    rawMedia &&
    rawMedia.startsWith('https://') &&
    !rawMedia.includes('localhost') &&
    !rawMedia.includes('127.0.0.1')
      ? rawMedia
      : undefined;

  if (!accountSid || !authToken || !from) {
    return { sent: false, skipped: true, reason: 'Twilio not configured' };
  }

  const postMessage = async (withMedia?: string) => {
    const params = new URLSearchParams();
    params.set('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from}`);
    params.set('To', `whatsapp:${normalizeWhatsAppPhone(toPhone)}`);

    if (contentSid && !withMedia) {
      params.set('ContentSid', contentSid);
      params.set('ContentVariables', JSON.stringify({ 1: body.slice(0, 1024) }));
    } else {
      params.set('Body', body);
      if (withMedia) params.set('MediaUrl', withMedia);
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      },
    );

    const result = await response.json();
    if (!response.ok) {
      return {
        sent: false as const,
        reason: result?.message || 'Twilio request failed',
        code: result?.code,
      };
    }

    return { sent: true as const, sid: result.sid as string };
  };

  if (mediaUrl) {
    const withPhoto = await postMessage(mediaUrl);
    if (withPhoto.sent) return withPhoto;
    console.warn('[twilioWhatsApp] media send failed, retrying text-only', withPhoto.reason);
  }

  return postMessage();
};

export const twilioWhatsAppHint = (code?: number | string, reason?: string) => {
  if (String(code) === '63007') {
    return 'Twilio sandbox: join the sandbox from your phone (send the join code to the Twilio WhatsApp number) and set TWILIO_WHATSAPP_FROM to your sandbox number.';
  }
  if (String(code) === '63015') {
    return 'Recipient must opt in to WhatsApp sandbox first (send join code to Twilio sandbox number).';
  }
  if (reason?.toLowerCase().includes('not configured')) {
    return 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM in Supabase Edge Function secrets.';
  }
  return undefined;
};
