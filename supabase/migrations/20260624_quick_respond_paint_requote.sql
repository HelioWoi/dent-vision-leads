-- Quick-respond link: PDR+paint quotes, allow re-quote on quoted/inspection leads

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
    'can_respond', v_match.status in ('new', 'expired', 'quoted', 'inspection'),
    'already_responded', v_match.status in ('declined', 'booked', 'completed'),
    'match_status', v_match.status,
    'response_deadline', v_match.response_deadline,
    'bodyshop_name', v_shop.business_name,
    'bodyshop_region', v_shop.region,
    'existing_quote', jsonb_build_object(
      'quote_min', v_match.shop_price_min,
      'quote_max', v_match.shop_price_max,
      'quote_pdr', v_match.quote_pdr_min,
      'quote_paint', v_match.quote_paint_min,
      'shop_note', v_match.shop_note
    ),
    'lead', jsonb_build_object(
      'id', v_lead.id,
      'customer_name', v_lead.customer_name,
      'postal_code', v_lead.postal_code,
      'damage_category', v_lead.ai_damage_category,
      'damage_location', v_lead.damage_location,
      'dent_count', v_lead.dent_count,
      'ai_estimate_min', coalesce(v_lead.ai_pdr_estimate_min, v_lead.ai_estimate_min),
      'ai_estimate_max', coalesce(v_lead.ai_pdr_estimate_max, v_lead.ai_estimate_max),
      'ai_pdr_estimate_min', coalesce(v_lead.ai_pdr_estimate_min, v_lead.ai_estimate_min),
      'ai_pdr_estimate_max', coalesce(v_lead.ai_pdr_estimate_max, v_lead.ai_estimate_max),
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
  p_quote_pdr numeric default null,
  p_quote_paint numeric default null,
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
  v_lead record;
  v_status text;
  v_now timestamptz := now();
  v_quote numeric;
  v_pdr numeric;
  v_paint numeric;
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

  if v_match.status in ('declined', 'booked', 'completed') then
    raise exception 'This lead can no longer be updated via this link.';
  end if;

  select * into v_lead from public.lead_requests where id = v_t.lead_id;

  if p_action = 'decline' then
    v_status := 'declined';
  elsif p_action = 'inspection' then
    v_status := 'inspection';
  else
    v_status := 'quoted';
  end if;

  if p_action = 'accept_ai' then
    v_pdr := coalesce(v_lead.ai_pdr_estimate_min, v_lead.ai_estimate_min, v_match.ai_estimate_min);
    v_paint := 0;
    v_quote := v_pdr;
  else
    v_pdr := coalesce(p_quote_pdr, p_quote_min);
    v_paint := coalesce(p_quote_paint, 0);
    v_quote := coalesce(p_quote_min, v_pdr + v_paint);
  end if;

  update public.shop_lead_matches
  set
    status = v_status,
    shop_price_min = case when v_status = 'quoted' then coalesce(v_quote, shop_price_min) else shop_price_min end,
    shop_price_max = case when v_status = 'quoted' then coalesce(p_quote_max, v_quote, shop_price_max) else shop_price_max end,
    quote_pdr_min = case when v_status = 'quoted' then v_pdr else quote_pdr_min end,
    quote_pdr_max = case when v_status = 'quoted' then v_pdr else quote_pdr_max end,
    quote_paint_min = case when v_status = 'quoted' and v_paint > 0 then v_paint else quote_paint_min end,
    quote_paint_max = case when v_status = 'quoted' and v_paint > 0 then v_paint else quote_paint_max end,
    shop_note = coalesce(nullif(trim(p_note), ''), shop_note),
    responded_at = v_now
  where id = v_match.id;

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
      'quote_pdr', v_pdr,
      'quote_paint', nullif(v_paint, 0),
      'via', 'partner_quick_respond'
    )
  );

  return jsonb_build_object(
    'ok', true,
    'status', v_status,
    'quote_min', v_quote,
    'quote_max', coalesce(p_quote_max, v_quote),
    'quote_pdr', v_pdr,
    'quote_paint', nullif(v_paint, 0)
  );
end;
$$;
