-- Partner lead linking, paint repair fields, Sunshine Coast demo shop, partner RLS

alter table public.bodyshops
  add column if not exists accepts_pdr boolean not null default true,
  add column if not exists accepts_paint_repair boolean not null default true,
  add column if not exists operating_hours text;

alter table public.lead_requests
  add column if not exists paint_repair_needed boolean not null default false,
  add column if not exists ai_pdr_estimate_min numeric,
  add column if not exists ai_pdr_estimate_max numeric,
  add column if not exists photo_urls jsonb;

alter table public.shop_lead_matches
  add column if not exists distance_miles numeric,
  add column if not exists quote_pdr_min numeric,
  add column if not exists quote_pdr_max numeric,
  add column if not exists quote_paint_min numeric,
  add column if not exists quote_paint_max numeric;

-- Demo shop: Sunshine Coast (single shop for in-person sales testing)
insert into public.bodyshops (
  id,
  business_name,
  owner_name,
  email,
  phone,
  address,
  postal_code,
  service_radius,
  region,
  verified_status,
  active_status,
  notification_enabled,
  accepts_pdr,
  accepts_paint_repair,
  operating_hours
) values (
  '550e8400-e29b-41d4-a716-446655440001',
  'Sunshine Coast PDR Co.',
  'Demo Owner',
  'heliocwoi@gmail.com',
  '+61 400 000 000',
  'Maroochydore QLD',
  '4558',
  35,
  'Sunshine Coast, QLD',
  true,
  true,
  true,
  true,
  true,
  'Mon-Fri 07:30-17:30, Sat 08:00-12:00'
) on conflict (id) do update set
  business_name = excluded.business_name,
  region = excluded.region,
  email = excluded.email,
  active_status = true,
  notification_enabled = true;

insert into public.bodyshop_owners (
  bodyshop_id,
  name,
  email,
  role,
  active_status
) values (
  '550e8400-e29b-41d4-a716-446655440001',
  'Demo Owner',
  'heliocwoi@gmail.com',
  'owner',
  true
) on conflict do nothing;

insert into public.notification_settings (
  bodyshop_id,
  push_enabled,
  sms_enabled,
  email_enabled,
  dashboard_enabled,
  primary_channel,
  backup_channel,
  response_deadline_seconds,
  notification_radius,
  lead_categories_accepted
) select
  '550e8400-e29b-41d4-a716-446655440001',
  true,
  false,
  true,
  true,
  'email',
  'dashboard',
  300,
  35,
  array['pdr', 'hail', 'crease', 'paint']
where not exists (
  select 1 from public.notification_settings
  where bodyshop_id = '550e8400-e29b-41d4-a716-446655440001'
);

-- Customer flow: create leads + matches (anon/authenticated)
do $$ begin
  create policy "Public insert lead_requests"
    on public.lead_requests for insert
    to anon, authenticated
    with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Public insert shop_lead_matches"
    on public.shop_lead_matches for insert
    to anon, authenticated
    with check (true);
exception when duplicate_object then null;
end $$;

-- Partners read/update their shop data
create or replace function public.partner_bodyshop_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select bo.bodyshop_id
  from public.bodyshop_owners bo
  where bo.bodyshop_id is not null
    and (
      bo.user_id = auth.uid()
      or lower(bo.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

do $$ begin
  create policy "Partners read own bodyshops"
    on public.bodyshops for select
    to authenticated
    using (id in (select public.partner_bodyshop_ids()) or public.is_admin_user());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Partners update own bodyshops"
    on public.bodyshops for update
    to authenticated
    using (id in (select public.partner_bodyshop_ids()) or public.is_admin_user())
    with check (id in (select public.partner_bodyshop_ids()) or public.is_admin_user());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Partners read own matches"
    on public.shop_lead_matches for select
    to authenticated
    using (bodyshop_id in (select public.partner_bodyshop_ids()) or public.is_admin_user());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Partners update own matches"
    on public.shop_lead_matches for update
    to authenticated
    using (bodyshop_id in (select public.partner_bodyshop_ids()) or public.is_admin_user())
    with check (bodyshop_id in (select public.partner_bodyshop_ids()) or public.is_admin_user());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Partners read matched leads"
    on public.lead_requests for select
    to authenticated
    using (
      public.is_admin_user()
      or exists (
        select 1 from public.shop_lead_matches m
        where m.lead_id = lead_requests.id
          and m.bodyshop_id in (select public.partner_bodyshop_ids())
      )
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Partners read own notification settings"
    on public.notification_settings for select
    to authenticated
    using (bodyshop_id in (select public.partner_bodyshop_ids()) or public.is_admin_user());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Partners upsert own notification settings"
    on public.notification_settings for all
    to authenticated
    using (bodyshop_id in (select public.partner_bodyshop_ids()) or public.is_admin_user())
    with check (bodyshop_id in (select public.partner_bodyshop_ids()) or public.is_admin_user());
exception when duplicate_object then null;
end $$;
