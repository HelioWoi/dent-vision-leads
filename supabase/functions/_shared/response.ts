export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const ok = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

export const fail = (error: string, code = 'REQUEST_FAILED', status = 400) =>
  new Response(JSON.stringify({ success: false, error, code }), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
