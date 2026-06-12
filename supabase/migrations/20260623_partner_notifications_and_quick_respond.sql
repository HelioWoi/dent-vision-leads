-- Partner notifications: WhatsApp settings, push subscriptions, magic-link lead respond

alter table public.notification_settings
  add column if not exists whatsapp_phone text,
  add column if not exists whatsapp_message_template text;

create table if not exists public.partner_lead_action_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  match_id uuid not null references public.shop_lead_matches(id) on delete cascade,
  lead_id uuid not null references public.lead_requests(id) on delete cascade,
  bodyshop_id uuid not null references public.bodyshops(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (match_id)
);

create table if not exists public.partner_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  bodyshop_id uuid not null references public.bodyshops(id) on delete cascade,
  owner_id uuid references public.bodyshop_owners(id) on delete set null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists partner_push_subscriptions_shop_idx on public.partner_push_subscriptions(bodyshop_id);

alter table public.partner_lead_action_tokens enable row level security;
alter table public.partner_push_subscriptions enable row level security;

do $$ begin
  create policy "Partners read own push subscriptions"
    on public.partner_push_subscriptions for select
    to authenticated
    using (bodyshop_id in (select public.partner_bodyshop_ids()) or public.is_admin_user());
exception when duplicate_object then null;
end $$;

create or replace function public.provision_partner_lead_token(p_match_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_match record;
begin
  select m.id, m.lead_id, m.bodyshop_id
  into v_match
  from public.shop_lead_matches m
  where m.id = p_match_id;

  if v_match.id is null then
    raise exception 'Match not found.';
  end if;

  insert into public.partner_lead_action_tokens (match_id, lead_id, bodyshop_id)
  values (v_match.id, v_match.lead_id, v_match.bodyshop_id)
  on conflict (match_id) do update set expires_at = now() + interval '7 days'
  returning token into v_token;

  return v_token;
end;
$$;

create or replace function public.get_partner_lead_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t record;
  v_lead record;
  v_match record;
  v_shop record;
begin
  select t.* into v_t
  from public.partner_lead_action_tokens t
  where t.token = p_token
  limit 1;

  if v_t.id is null then
    return jsonb_build_object('valid', false);
  end if;

  if v_t.expires_at < now() then
    return jsonb_build_object('valid', false, 'expired', true);
  end if;

  select * into v_lead from public.lead_requests where id = v_t.lead_id;
  select * into v_match from public.shop_lead_matches where id = v_t.match_id;
  select business_name, region into v_shop from public.bodyshops where id = v_t.bodyshop_id;

  return jsonb_build_object(
    'valid', true,
    'token', v_t.token,
    'already_responded', v_match.status not in ('new', 'expired'),
    'match_status', v_match.status,
    'response_deadline', v_match.response_deadline,
    'bodyshop_name', v_shop.business_name,
    'bodyshop_region', v_shop.region,
    'lead', jsonb_build_object(
      'id', v_lead.id,
      'customer_name', v_lead.customer_name,
      'postal_code', v_lead.postal_code,
      'damage_category', v_lead.ai_damage_category,
      'damage_location', v_lead.damage_location,
      'dent_count', v_lead.dent_count,
      'ai_estimate_min', coalesce(v_lead.ai_pdr_estimate_min, v_lead.ai_estimate_min),
      'ai_estimate_max', coalesce(v_lead.ai_pdr_estimate_max, v_lead.ai_estimate_max),
      'paint_repair_needed', v_lead.paint_repair_needed,
      'customer_comment', v_lead.customer_comment,
      'photo_urls', v_lead.photo_urls,
      'photo_url', v_lead.photo_url
    )
  );
end;
$$;

create or replace function public.respond_partner_lead_by_token(
  p_token text,
  p_action text,
  p_quote_min numeric default null,
  p_quote_max numeric default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t record;
  v_match record;
  v_status text;
  v_now timestamptz := now();
  v_quote numeric;
begin
  if p_action not in ('accept_ai', 'quote', 'decline', 'inspection') then
    raise exception 'Invalid action.';
  end if;

  select t.* into v_t
  from public.partner_lead_action_tokens t
  where t.token = p_token
  limit 1;

  if v_t.id is null or v_t.expires_at < v_now then
    raise exception 'Invalid or expired link.';
  end if;

  select * into v_match
  from public.shop_lead_matches
  where id = v_t.match_id;

  if v_match.status not in ('new', 'expired') then
    raise exception 'This lead was already responded to.';
  end if;

  if p_action = 'decline' then
    v_status := 'declined';
  elsif p_action = 'inspection' then
    v_status := 'inspection';
  else
    v_status := 'quoted';
  end if;

  if p_action = 'accept_ai' then
    v_quote := coalesce(v_match.ai_estimate_min, v_match.ai_estimate_max);
  else
    v_quote := p_quote_min;
  end if;

  update public.shop_lead_matches
  set
    status = v_status,
    shop_price_min = case when v_status = 'quoted' then coalesce(v_quote, shop_price_min) else shop_price_min end,
    shop_price_max = case when v_status = 'quoted' then coalesce(p_quote_max, v_quote, shop_price_max) else shop_price_max end,
    shop_note = coalesce(nullif(trim(p_note), ''), shop_note),
    responded_at = v_now
  where id = v_match.id;

  update public.partner_lead_action_tokens
  set used_at = v_now
  where id = v_t.id;

  perform public.append_lead_event(
    v_t.lead_id,
    v_t.bodyshop_id,
    case
      when p_action = 'decline' then 'lead_declined'
      when p_action = 'inspection' then 'inspection_requested'
      else 'quote_sent'
    end,
    coalesce(nullif(trim(p_note), ''), 'Shop responded via quick quote link'),
    jsonb_build_object(
      'action', p_action,
      'quote_min', v_quote,
      'quote_max', coalesce(p_quote_max, v_quote),
      'via', 'partner_quick_respond'
    )
  );

  return jsonb_build_object(
    'ok', true,
    'status', v_status,
    'quote_min', v_quote,
    'quote_max', coalesce(p_quote_max, v_quote)
  );
end;
$$;

create or replace function public.save_partner_push_subscription(
  p_bodyshop_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_owner_id uuid;
begin
  if not (
    p_bodyshop_id in (select public.partner_bodyshop_ids())
    or public.is_admin_user()
  ) then
    raise exception 'Not authorized.';
  end if;

  select id into v_owner_id
  from public.bodyshop_owners
  where bodyshop_id = p_bodyshop_id
  limit 1;

  insert into public.partner_push_subscriptions (bodyshop_id, owner_id, endpoint, p256dh, auth, user_agent)
  values (p_bodyshop_id, v_owner_id, p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update set
    bodyshop_id = excluded.bodyshop_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.get_partner_push_subscriptions(p_bodyshop_id uuid)
returns table (endpoint text, p256dh text, auth text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select s.endpoint, s.p256dh, s.auth
  from public.partner_push_subscriptions s
  where s.bodyshop_id = p_bodyshop_id;
end;
$$;

grant execute on function public.provision_partner_lead_token(uuid) to anon, authenticated, service_role;
grant execute on function public.get_partner_lead_by_token(text) to anon, authenticated;
grant execute on function public.respond_partner_lead_by_token(text, text, numeric, numeric, text) to anon, authenticated;
grant execute on function public.save_partner_push_subscription(uuid, text, text, text, text) to authenticated;
grant execute on function public.get_partner_push_subscriptions(uuid) to service_role;
