import { corsHeaders, fail, ok } from '../_shared/response.ts';

type LookupRegoInput = {
  rego?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return fail('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  try {
    const body = (await req.json()) as LookupRegoInput;
    const rego = (body.rego || '').trim().toUpperCase();

    if (!rego) {
      return fail('Missing rego', 'INVALID_PAYLOAD', 400);
    }

    return ok({
      rego,
      make: 'Toyota',
      model: 'Corolla',
      year: 2020,
      colour: 'White',
      body_type: 'Sedan',
      state: 'NSW',
    });
  } catch (error) {
    console.error('[lookup-rego] error', error);
    return fail('Invalid request body', 'INVALID_JSON', 400);
  }
});
