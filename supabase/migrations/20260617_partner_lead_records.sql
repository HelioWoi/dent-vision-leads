-- Lead records: booking fields, event history, photo storage, booking RPC

alter table public.lead_requests
  add column if not exists customer_comment text,
  add column if not exists vehicle_rego text,
  add column if not exists preferred_date date,
  add column if not exists preferred_time text,
  add column if not exists booked_at timestamptz;

alter table public.shop_lead_matches
  add column if not exists booked_at timestamptz;

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.lead_requests(id) on delete cascade,
  bodyshop_id uuid references public.bodyshops(id) on delete set null,
  event_type text not null,
  message text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lead_events_lead_id_idx on public.lead_events (lead_id, created_at desc);

alter table public.lead_events enable row level security;

do $$ begin
  create policy "Partners read lead events"
    on public.lead_events for select
    to authenticated
    using (
      public.is_admin_user()
      or bodyshop_id in (select public.partner_bodyshop_ids())
      or exists (
        select 1 from public.shop_lead_matches m
        where m.lead_id = lead_events.lead_id
          and m.bodyshop_id in (select public.partner_bodyshop_ids())
      )
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Public insert lead events"
    on public.lead_events for insert
    to anon, authenticated
    with check (true);
exception when duplicate_object then null;
end $$;

-- Photo storage bucket (public read for partner dashboard)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lead-photos',
  'lead-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set public = true;

do $$ begin
  create policy "Public upload lead photos"
    on storage.objects for insert
    to anon, authenticated
    with check (bucket_id = 'lead-photos');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Public read lead photos"
    on storage.objects for select
    to anon, authenticated
    using (bucket_id = 'lead-photos');
exception when duplicate_object then null;
end $$;

create or replace function public.append_lead_event(
  p_lead_id uuid,
  p_bodyshop_id uuid default null,
  p_event_type text default 'note',
  p_message text default null,
  p_payload jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.lead_events (lead_id, bodyshop_id, event_type, message, payload)
  values (p_lead_id, p_bodyshop_id, p_event_type, p_message, p_payload)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.append_lead_event(uuid, uuid, text, text, jsonb) to anon, authenticated;

-- Extend create_public_lead with comment + photos
create or replace function public.create_public_lead(
  p_customer_name text,
  p_customer_email text default null,
  p_postal_code text default null,
  p_region text default 'Sunshine Coast, QLD',
  p_ai_damage_category text default null,
  p_damage_location text default null,
  p_dent_count integer default 1,
  p_ai_estimate_min numeric default null,
  p_ai_estimate_max numeric default null,
  p_ai_pdr_estimate_min numeric default null,
  p_ai_pdr_estimate_max numeric default null,
  p_paint_repair_needed boolean default false,
  p_photo_urls jsonb default null,
  p_customer_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
begin
  insert into public.lead_requests (
    customer_name, customer_email, postal_code, region,
    ai_damage_category, damage_location, dent_count,
    ai_estimate_min, ai_estimate_max,
    ai_pdr_estimate_min, ai_pdr_estimate_max,
    paint_repair_needed, photo_urls, customer_comment, status
  ) values (
    coalesce(nullif(trim(p_customer_name), ''), 'Customer'),
    p_customer_email, p_postal_code,
    coalesce(nullif(trim(p_region), ''), 'Sunshine Coast, QLD'),
    p_ai_damage_category, p_damage_location,
    greatest(1, coalesce(p_dent_count, 1)),
    p_ai_estimate_min, p_ai_estimate_max,
    coalesce(p_ai_pdr_estimate_min, p_ai_estimate_min),
    coalesce(p_ai_pdr_estimate_max, p_ai_estimate_max),
    coalesce(p_paint_repair_needed, false),
    p_photo_urls, p_customer_comment, 'new'
  )
  returning id into v_lead_id;

  perform public.append_lead_event(
    v_lead_id, null, 'lead_created',
    'Customer submitted damage photos and estimate request',
    jsonb_build_object(
      'damage_category', p_ai_damage_category,
      'location', p_damage_location,
      'dent_count', p_dent_count,
      'photo_count', coalesce(jsonb_array_length(p_photo_urls), 0)
    )
  );

  return v_lead_id;
end;
$$;

create or replace function public.create_public_lead_match(
  p_lead_id uuid,
  p_bodyshop_id uuid,
  p_ai_estimate_min numeric default null,
  p_ai_estimate_max numeric default null,
  p_response_deadline timestamptz default null,
  p_distance_miles numeric default 1.3
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
begin
  insert into public.shop_lead_matches (
    lead_id, bodyshop_id, status,
    ai_estimate_min, ai_estimate_max,
    response_deadline, distance_miles
  ) values (
    p_lead_id, p_bodyshop_id, 'new',
    p_ai_estimate_min, p_ai_estimate_max,
    coalesce(p_response_deadline, now() + interval '5 minutes'),
    coalesce(p_distance_miles, 1.3)
  )
  returning id into v_match_id;

  perform public.append_lead_event(
    p_lead_id, p_bodyshop_id, 'lead_dispatched',
    'Lead sent to bodyshop for review',
    jsonb_build_object('match_id', v_match_id)
  );

  return v_match_id;
end;
$$;

create or replace function public.book_existing_lead(
  p_lead_id uuid,
  p_bodyshop_id uuid,
  p_customer_phone text,
  p_vehicle_rego text default null,
  p_preferred_date date default null,
  p_preferred_time text default null,
  p_customer_note text default null,
  p_shop_price numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_now timestamptz := now();
begin
  update public.lead_requests
  set
    customer_phone = coalesce(nullif(trim(p_customer_phone), ''), customer_phone),
    vehicle_rego = coalesce(nullif(trim(p_vehicle_rego), ''), vehicle_rego),
    preferred_date = coalesce(p_preferred_date, preferred_date),
    preferred_time = coalesce(nullif(trim(p_preferred_time), ''), preferred_time),
    status = 'booked',
    booked_at = v_now
  where id = p_lead_id;

  update public.shop_lead_matches
  set
    status = 'booked',
    shop_price_min = coalesce(p_shop_price, shop_price_min),
    shop_price_max = coalesce(p_shop_price, shop_price_max),
    shop_note = coalesce(
      nullif(trim(p_customer_note), ''),
      shop_note
    ),
    booked_at = v_now,
    responded_at = coalesce(responded_at, v_now)
  where lead_id = p_lead_id and bodyshop_id = p_bodyshop_id
  returning id into v_match_id;

  if v_match_id is null then
    insert into public.shop_lead_matches (
      lead_id, bodyshop_id, status,
      shop_price_min, shop_price_max,
      shop_note, booked_at, responded_at
    ) values (
      p_lead_id, p_bodyshop_id, 'booked',
      p_shop_price, p_shop_price,
      p_customer_note, v_now, v_now
    )
    returning id into v_match_id;
  end if;

  perform public.append_lead_event(
    p_lead_id, p_bodyshop_id, 'booking_confirmed',
    'Customer confirmed booking',
    jsonb_build_object(
      'preferred_date', p_preferred_date,
      'preferred_time', p_preferred_time,
      'vehicle_rego', p_vehicle_rego
    )
  );

  return v_match_id;
end;
$$;

grant execute on function public.create_public_lead(
  text, text, text, text, text, text, integer, numeric, numeric, numeric, numeric, boolean, jsonb, text
) to anon, authenticated;

grant execute on function public.book_existing_lead(
  uuid, uuid, text, text, date, text, text, numeric
) to anon, authenticated;
