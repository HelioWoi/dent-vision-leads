-- Public lead dispatch via SECURITY DEFINER (anon insert RLS edge case on local PG)

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
  p_photo_urls jsonb default null
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
    customer_name,
    customer_email,
    postal_code,
    region,
    ai_damage_category,
    damage_location,
    dent_count,
    ai_estimate_min,
    ai_estimate_max,
    ai_pdr_estimate_min,
    ai_pdr_estimate_max,
    paint_repair_needed,
    photo_urls,
    status
  ) values (
    coalesce(nullif(trim(p_customer_name), ''), 'Customer'),
    p_customer_email,
    p_postal_code,
    coalesce(nullif(trim(p_region), ''), 'Sunshine Coast, QLD'),
    p_ai_damage_category,
    p_damage_location,
    greatest(1, coalesce(p_dent_count, 1)),
    p_ai_estimate_min,
    p_ai_estimate_max,
    coalesce(p_ai_pdr_estimate_min, p_ai_estimate_min),
    coalesce(p_ai_pdr_estimate_max, p_ai_estimate_max),
    coalesce(p_paint_repair_needed, false),
    p_photo_urls,
    'new'
  )
  returning id into v_lead_id;

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
    lead_id,
    bodyshop_id,
    status,
    ai_estimate_min,
    ai_estimate_max,
    response_deadline,
    distance_miles
  ) values (
    p_lead_id,
    p_bodyshop_id,
    'new',
    p_ai_estimate_min,
    p_ai_estimate_max,
    coalesce(p_response_deadline, now() + interval '5 minutes'),
    coalesce(p_distance_miles, 1.3)
  )
  returning id into v_match_id;

  return v_match_id;
end;
$$;

grant execute on function public.create_public_lead(
  text, text, text, text, text, text, integer, numeric, numeric, numeric, numeric, boolean, jsonb
) to anon, authenticated;

grant execute on function public.create_public_lead_match(
  uuid, uuid, numeric, numeric, timestamptz, numeric
) to anon, authenticated;
