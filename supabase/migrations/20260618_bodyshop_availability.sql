-- Bodyshop booking availability: open slots customers can pick; syncs to partner calendar

create table if not exists public.bodyshop_availability_slots (
  id uuid primary key default gen_random_uuid(),
  bodyshop_id uuid not null references public.bodyshops(id) on delete cascade,
  slot_date date not null,
  time_period text not null check (time_period in ('morning', 'afternoon')),
  capacity integer not null default 1,
  booked_count integer not null default 0,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  unique (bodyshop_id, slot_date, time_period)
);

create index if not exists bodyshop_availability_slots_shop_date_idx
  on public.bodyshop_availability_slots (bodyshop_id, slot_date);

alter table public.bodyshop_availability_slots enable row level security;

do $$ begin
  create policy "Public read open availability"
    on public.bodyshop_availability_slots for select
    to anon, authenticated
    using (is_open = true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Partners manage own availability"
    on public.bodyshop_availability_slots for all
    to authenticated
    using (bodyshop_id in (select public.partner_bodyshop_ids()) or public.is_admin_user())
    with check (bodyshop_id in (select public.partner_bodyshop_ids()) or public.is_admin_user());
exception when duplicate_object then null;
end $$;

create or replace function public.period_to_label(p_period text)
returns text
language sql
immutable
as $$
  select case p_period
    when 'morning' then 'Morning (08:00-12:00)'
    when 'afternoon' then 'Afternoon (12:00-17:00)'
    else p_period
  end;
$$;

create or replace function public.label_to_period(p_label text)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(p_label, '')) like '%morning%' then 'morning'
    when lower(coalesce(p_label, '')) like '%afternoon%' then 'afternoon'
    else 'morning'
  end;
$$;

create or replace function public.ensure_bodyshop_availability(
  p_bodyshop_id uuid,
  p_days integer default 28
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
  v_dow integer;
begin
  for i in 1..greatest(p_days, 1) loop
    v_day := (current_date + i);
    v_dow := extract(dow from v_day)::integer;
    if v_dow = 0 then
      continue;
    end if;

    insert into public.bodyshop_availability_slots (bodyshop_id, slot_date, time_period, is_open)
    values (p_bodyshop_id, v_day, 'morning', true),
           (p_bodyshop_id, v_day, 'afternoon', v_dow <> 6)
    on conflict (bodyshop_id, slot_date, time_period) do nothing;
  end loop;
end;
$$;

grant execute on function public.ensure_bodyshop_availability(uuid, integer) to anon, authenticated;

create or replace function public.get_bodyshop_availability(
  p_bodyshop_id uuid,
  p_days integer default 42
)
returns table (
  slot_date date,
  time_period text,
  time_label text,
  spots_left integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_bodyshop_availability(p_bodyshop_id, least(greatest(p_days, 7), 60));

  return query
  select
    s.slot_date,
    s.time_period,
    public.period_to_label(s.time_period) as time_label,
    greatest(0, s.capacity - s.booked_count)::integer as spots_left
  from public.bodyshop_availability_slots s
  where s.bodyshop_id = p_bodyshop_id
    and s.is_open = true
    and s.slot_date >= current_date
    and s.slot_date <= current_date + least(greatest(p_days, 7), 60)
    and s.booked_count < s.capacity
  order by s.slot_date, s.time_period;
end;
$$;

grant execute on function public.get_bodyshop_availability(uuid, integer) to anon, authenticated;

create or replace function public.get_bodyshop_availability_admin(
  p_bodyshop_id uuid,
  p_days integer default 42
)
returns table (
  slot_date date,
  time_period text,
  time_label text,
  is_open boolean,
  capacity integer,
  booked_count integer,
  spots_left integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_bodyshop_availability(p_bodyshop_id, least(greatest(p_days, 7), 60));

  return query
  select
    s.slot_date,
    s.time_period,
    public.period_to_label(s.time_period) as time_label,
    s.is_open,
    s.capacity,
    s.booked_count,
    greatest(0, s.capacity - s.booked_count)::integer as spots_left
  from public.bodyshop_availability_slots s
  where s.bodyshop_id = p_bodyshop_id
    and s.slot_date >= current_date
    and s.slot_date <= current_date + least(greatest(p_days, 7), 60)
  order by s.slot_date, s.time_period;
end;
$$;

grant execute on function public.get_bodyshop_availability_admin(uuid, integer) to authenticated;

create or replace function public.set_bodyshop_slot_open(
  p_bodyshop_id uuid,
  p_slot_date date,
  p_time_period text,
  p_is_open boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bodyshop_availability_slots (bodyshop_id, slot_date, time_period, is_open)
  values (p_bodyshop_id, p_slot_date, p_time_period, p_is_open)
  on conflict (bodyshop_id, slot_date, time_period)
  do update set is_open = excluded.is_open;
end;
$$;

grant execute on function public.set_bodyshop_slot_open(uuid, date, text, boolean) to authenticated;

create or replace function public.reserve_bodyshop_slot(
  p_bodyshop_id uuid,
  p_slot_date date,
  p_time_period text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.bodyshop_availability_slots
  set booked_count = booked_count + 1
  where bodyshop_id = p_bodyshop_id
    and slot_date = p_slot_date
    and time_period = p_time_period
    and is_open = true
    and booked_count < capacity
  returning 1 into v_updated;

  return coalesce(v_updated, 0) = 1;
end;
$$;

grant execute on function public.reserve_bodyshop_slot(uuid, date, text) to anon, authenticated;

-- Seed demo shop availability
select public.ensure_bodyshop_availability('550e8400-e29b-41d4-a716-446655440001'::uuid, 28);

-- Extend booking RPC to reserve slot + event
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
  v_period text;
  v_reserved boolean := false;
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
    shop_note = coalesce(nullif(trim(p_customer_note), ''), shop_note),
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

  if p_preferred_date is not null then
    v_period := public.label_to_period(p_preferred_time);
    v_reserved := public.reserve_bodyshop_slot(p_bodyshop_id, p_preferred_date, v_period);
  end if;

  perform public.append_lead_event(
    p_lead_id, p_bodyshop_id, 'booking_confirmed',
    'Customer confirmed booking' || case when p_preferred_date is not null
      then ' for ' || p_preferred_date::text || coalesce(' · ' || nullif(trim(p_preferred_time), ''), '')
      else '' end,
    jsonb_build_object(
      'preferred_date', p_preferred_date,
      'preferred_time', p_preferred_time,
      'vehicle_rego', p_vehicle_rego,
      'slot_reserved', v_reserved
    )
  );

  return v_match_id;
end;
$$;

grant execute on function public.book_existing_lead(
  uuid, uuid, text, text, date, text, text, numeric
) to anon, authenticated;
