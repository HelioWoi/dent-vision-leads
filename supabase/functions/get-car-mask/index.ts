import { corsHeaders, fail, ok } from '../_shared/response.ts';

type GetCarMaskInput = {
  image?: string;
  imageType?: string;
};

const DEFAULT_MASK: [number, number][] = [
  [0.12, 0.18],
  [0.88, 0.18],
  [0.94, 0.56],
  [0.82, 0.78],
  [0.16, 0.78],
  [0.06, 0.56],
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return fail('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  try {
    const body = (await req.json()) as GetCarMaskInput;
    if (!body.image || body.image.length < 300) {
      return fail('Missing image payload', 'INVALID_PAYLOAD', 400);
    }

    return ok({ mask: DEFAULT_MASK });
  } catch (error) {
    console.error('[get-car-mask] error', error);
    return fail('Invalid request body', 'INVALID_JSON', 400);
  }
});
