import { corsHeaders, fail, ok } from '../_shared/response.ts';

interface ReviewEmailPayload {
  token: string;
  customerEmail: string;
  customerName?: string;
  bodyshopName: string;
  reviewUrl: string;
  leadId?: string;
  bodyshopId?: string;
}

const buildEmailHtml = (payload: ReviewEmailPayload) => {
  const firstName = (payload.customerName || 'there').split(' ')[0];
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#4f46e5;margin-bottom:8px;">How was your PDR repair?</h2>
  <p>Hi ${firstName},</p>
  <p><strong>${payload.bodyshopName}</strong> has marked your dent repair as completed via Dent Vision.</p>
  <p>Please take 30 seconds to confirm the service was delivered and rate your experience:</p>
  <p style="margin:28px 0;">
    <a href="${payload.reviewUrl}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;display:inline-block;">
      Rate your service
    </a>
  </p>
  <p style="font-size:13px;color:#64748b;">This link expires in 30 days. Your feedback helps us verify completed jobs and improve partner quality.</p>
  <p style="font-size:12px;color:#94a3b8;">Dent Vision Leads · Sunshine Coast PDR network</p>
</body>
</html>`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return fail('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  try {
    const payload = (await req.json()) as ReviewEmailPayload;

    if (!payload.token || !payload.customerEmail || !payload.reviewUrl || !payload.bodyshopName) {
      return fail('Missing required fields: token, customerEmail, reviewUrl, bodyshopName');
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Dent Vision <onboarding@resend.dev>';
    const subject = `Rate your repair at ${payload.bodyshopName}`;

    if (!resendKey) {
      console.warn('[send-service-review-email] RESEND_API_KEY not set — email skipped (dev mode)');
      return ok({
        sent: false,
        devMode: true,
        message: 'Email provider not configured. Share review link manually.',
        reviewUrl: payload.reviewUrl,
      });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [payload.customerEmail],
        subject,
        html: buildEmailHtml(payload),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[send-service-review-email] Resend error', result);
      return fail(result?.message || 'Failed to send email', 'EMAIL_FAILED', 502);
    }

    return ok({
      sent: true,
      messageId: result.id,
      reviewUrl: payload.reviewUrl,
    });
  } catch (error) {
    console.error('[send-service-review-email]', error);
    return fail(error instanceof Error ? error.message : 'Unexpected error', 'INTERNAL_ERROR', 500);
  }
});
