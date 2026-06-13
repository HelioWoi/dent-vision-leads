-- =============================================================================
-- Dent Vision Leads — production smoke-test setup
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Project: wtfstakxspbnghalelby (Dent Vision Leads)
-- =============================================================================

-- Demo Sunshine Coast shop (seeded in migrations)
-- shop id: 550e8400-e29b-41d4-a716-446655440001

-- ---------------------------------------------------------------------------
-- 1) Owner WhatsApp + notification channels
-- ---------------------------------------------------------------------------
UPDATE public.bodyshop_owners
SET phone = '+61491706580'
WHERE bodyshop_id = '550e8400-e29b-41d4-a716-446655440001';

UPDATE public.notification_settings
SET
  whatsapp_phone = '+61491706580',
  whatsapp_enabled = true,
  whatsapp_message_template = COALESCE(
    nullif(trim(whatsapp_message_template), ''),
    'Dent Vision — new lead in {{region}}
{{damage}} · {{estimate}}
Respond within 3 min: {{link}}'
  ),
  push_enabled = true,
  email_enabled = true,
  primary_channel = 'whatsapp',
  backup_channel = 'email',
  response_deadline_seconds = 180
WHERE bodyshop_id = '550e8400-e29b-41d4-a716-446655440001';

-- Create notification_settings row if migration seed was missing
INSERT INTO public.notification_settings (
  bodyshop_id,
  push_enabled,
  sms_enabled,
  email_enabled,
  whatsapp_enabled,
  whatsapp_phone,
  whatsapp_message_template,
  dashboard_enabled,
  primary_channel,
  backup_channel,
  response_deadline_seconds,
  notification_radius,
  lead_categories_accepted
)
SELECT
  '550e8400-e29b-41d4-a716-446655440001',
  true,
  false,
  true,
  true,
  '+61491706580',
  'Dent Vision — new lead in {{region}}
{{damage}} · {{estimate}}
Respond within 3 min: {{link}}',
  true,
  'whatsapp',
  'email',
  180,
  35,
  array['pdr', 'hail', 'crease', 'paint']
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_settings
  WHERE bodyshop_id = '550e8400-e29b-41d4-a716-446655440001'
);

-- Ensure shop accepts leads
UPDATE public.bodyshops
SET
  active_status = true,
  notification_enabled = true
WHERE id = '550e8400-e29b-41d4-a716-446655440001';

-- ---------------------------------------------------------------------------
-- 2) Reload PostgREST schema cache (fixes "function not in schema cache")
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 3) Verify RPCs exist (should return 1 row each)
-- ---------------------------------------------------------------------------
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_public_lead',
    'create_public_lead_match',
    'provision_partner_lead_token',
    'get_partner_lead_by_token',
    'respond_partner_lead_by_token'
  )
ORDER BY p.proname;

-- ---------------------------------------------------------------------------
-- 4) Verify shop + notifications config
-- ---------------------------------------------------------------------------
SELECT
  b.id,
  b.business_name,
  b.region,
  b.active_status,
  b.notification_enabled,
  ns.whatsapp_phone,
  ns.whatsapp_enabled,
  ns.push_enabled,
  ns.email_enabled,
  left(ns.whatsapp_message_template, 80) AS template_preview
FROM public.bodyshops b
LEFT JOIN public.notification_settings ns ON ns.bodyshop_id = b.id
WHERE b.id = '550e8400-e29b-41d4-a716-446655440001';

SELECT id, name, email, phone
FROM public.bodyshop_owners
WHERE bodyshop_id = '550e8400-e29b-41d4-a716-446655440001';

-- ---------------------------------------------------------------------------
-- 5) OPTIONAL — dry-run: create a test lead + match (uncomment to run)
-- ---------------------------------------------------------------------------
/*
DO $$
DECLARE
  v_lead_id uuid;
  v_match_id uuid;
  v_token text;
BEGIN
  v_lead_id := public.create_public_lead(
    p_customer_name := 'SQL Test Customer',
    p_customer_email := 'heliocwoi@gmail.com',
    p_postal_code := '4558',
    p_region := 'Sunshine Coast, QLD',
    p_ai_damage_category := 'Medium Dent',
    p_damage_location := 'Front door',
    p_dent_count := 2,
    p_ai_estimate_min := 280,
    p_ai_estimate_max := 420,
    p_ai_pdr_estimate_min := 280,
    p_ai_pdr_estimate_max := 420,
    p_paint_repair_needed := false,
    p_customer_comment := 'Created from Supabase SQL smoke test'
  );

  v_match_id := public.create_public_lead_match(
    p_lead_id := v_lead_id,
    p_bodyshop_id := '550e8400-e29b-41d4-a716-446655440001'::uuid,
    p_ai_estimate_min := 280,
    p_ai_estimate_max := 420,
    p_response_deadline := now() + interval '3 minutes',
    p_distance_miles := 1.2
  );

  v_token := public.provision_partner_lead_token(v_match_id);

  RAISE NOTICE 'lead_id=%', v_lead_id;
  RAISE NOTICE 'match_id=%', v_match_id;
  RAISE NOTICE 'quick_respond_token=%', v_token;
  RAISE NOTICE 'open: https://YOUR-SITE.netlify.app/#/p/lead?token=%', v_token;
END $$;
*/

-- ---------------------------------------------------------------------------
-- 6) OPTIONAL — list latest leads/matches after a real estimate test
-- ---------------------------------------------------------------------------
SELECT
  lr.id AS lead_id,
  lr.customer_name,
  lr.ai_damage_category,
  lr.ai_estimate_min,
  lr.ai_estimate_max,
  lr.created_at,
  m.id AS match_id,
  m.status AS match_status
FROM public.lead_requests lr
JOIN public.shop_lead_matches m ON m.lead_id = lr.id
WHERE m.bodyshop_id = '550e8400-e29b-41d4-a716-446655440001'
ORDER BY lr.created_at DESC
LIMIT 5;

SELECT
  t.token,
  t.expires_at,
  t.used_at,
  t.match_id
FROM public.partner_lead_action_tokens t
WHERE t.bodyshop_id = '550e8400-e29b-41d4-a716-446655440001'
ORDER BY t.created_at DESC
LIMIT 5;
