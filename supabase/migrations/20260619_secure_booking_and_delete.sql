-- Secure booking: lead must be assigned to bodyshop via shop_lead_matches (no orphan inserts)
-- Partner can remove leads from their panel

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
  v_match_status text;
  v_now timestamptz := now();
  v_period text;
  v_reserved boolean := false;
begin
  select id, status
  into v_match_id, v_match_status
  from public.shop_lead_matches
  where lead_id = p_lead_id
    and bodyshop_id = p_bodyshop_id
  limit 1;

  if v_match_id is null then
    raise exception 'This lead is not assigned to the selected bodyshop.';
  end if;

  if v_match_status in ('declined', 'expired', 'removed') then
    raise exception 'This lead is no longer available for booking (status: %).', v_match_status;
  end if;

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
    shop_price_min = coalesce(p_shop_price, shop_price_min, ai_estimate_min),
    shop_price_max = coalesce(p_shop_price, shop_price_max, ai_estimate_max),
    shop_note = coalesce(nullif(trim(p_customer_note), ''), shop_note),
    booked_at = v_now,
    responded_at = coalesce(responded_at, v_now)
  where id = v_match_id;

  if p_preferred_date is not null then
    v_period := public.label_to_period(p_preferred_time);
    v_reserved := public.reserve_bodyshop_slot(p_bodyshop_id, p_preferred_date, v_period);
  end if;

  perform public.append_lead_event(
    p_lead_id, p_bodyshop_id, 'booking_confirmed',
    'Customer confirmed booking with assigned bodyshop' || case when p_preferred_date is not null
      then ' for ' || p_preferred_date::text || coalesce(' · ' || nullif(trim(p_preferred_time), ''), '')
      else '' end,
    jsonb_build_object(
      'match_id', v_match_id,
      'bodyshop_id', p_bodyshop_id,
      'preferred_date', p_preferred_date,
      'preferred_time', p_preferred_time,
      'vehicle_rego', p_vehicle_rego,
      'slot_reserved', v_reserved
    )
  );

  return v_match_id;
end;
$$;

create or replace function public.delete_partner_lead(
  p_bodyshop_id uuid,
  p_lead_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
begin
  if auth.uid() is not null
     and p_bodyshop_id not in (select public.partner_bodyshop_ids())
     and not public.is_admin_user() then
    raise exception 'Not authorized to remove leads for this bodyshop.';
  end if;

  update public.shop_lead_matches
  set status = 'removed', responded_at = coalesce(responded_at, now())
  where bodyshop_id = p_bodyshop_id
    and lead_id = p_lead_id
  returning id into v_match_id;

  if v_match_id is null then
    raise exception 'Lead assignment not found for this bodyshop.';
  end if;

  perform public.append_lead_event(
    p_lead_id,
    p_bodyshop_id,
    'lead_removed',
    'Bodyshop removed this lead from their panel',
    jsonb_build_object('match_id', v_match_id)
  );
end;
$$;

grant execute on function public.delete_partner_lead(uuid, uuid) to authenticated;

create or replace function public.verify_lead_bodyshop_assignment(
  p_lead_id uuid,
  p_bodyshop_id uuid
)
returns table (
  assigned boolean,
  match_id uuid,
  match_status text,
  bodyshop_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    true as assigned,
    m.id as match_id,
    m.status as match_status,
    b.business_name as bodyshop_name
  from public.shop_lead_matches m
  join public.bodyshops b on b.id = m.bodyshop_id
  where m.lead_id = p_lead_id
    and m.bodyshop_id = p_bodyshop_id
  limit 1;
end;
$$;

grant execute on function public.verify_lead_bodyshop_assignment(uuid, uuid) to anon, authenticated;
