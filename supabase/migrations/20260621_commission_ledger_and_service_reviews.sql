-- Commission ledger (10% B2B) + service completion + customer review tokens

alter table public.lead_requests
  add column if not exists completed_at timestamptz;

alter table public.shop_lead_matches
  add column if not exists completed_at timestamptz;

create table if not exists public.commission_ledger (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.shop_lead_matches(id) on delete cascade,
  lead_id uuid not null references public.lead_requests(id) on delete cascade,
  bodyshop_id uuid not null references public.bodyshops(id) on delete cascade,
  job_value numeric not null default 0,
  commission_rate numeric not null default 0.10,
  commission_amount numeric not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'earned', 'invoiced', 'paid', 'cancelled')),
  booked_at timestamptz,
  completed_at timestamptz,
  invoiced_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_review_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.shop_lead_matches(id) on delete cascade,
  lead_id uuid not null references public.lead_requests(id) on delete cascade,
  bodyshop_id uuid not null references public.bodyshops(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  customer_email text,
  customer_name text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'submitted', 'expired')),
  rating smallint check (rating between 1 and 5),
  review_comment text,
  email_sent_at timestamptz,
  submitted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  unique (match_id)
);

create index if not exists commission_ledger_bodyshop_idx on public.commission_ledger(bodyshop_id, status);
create index if not exists service_review_token_idx on public.service_review_requests(token);

alter table public.commission_ledger enable row level security;
alter table public.service_review_requests enable row level security;

do $$ begin
  create policy "Partners read own commission ledger"
    on public.commission_ledger for select
    to authenticated
    using (bodyshop_id in (select public.partner_bodyshop_ids()) or public.is_admin_user());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Partners read own service reviews"
    on public.service_review_requests for select
    to authenticated
    using (bodyshop_id in (select public.partner_bodyshop_ids()) or public.is_admin_user());
exception when duplicate_object then null;
end $$;

create or replace function public.upsert_commission_on_booking(p_match_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_job_value numeric;
  v_commission numeric;
  v_ledger_id uuid;
begin
  select
    m.id,
    m.lead_id,
    m.bodyshop_id,
    m.status,
    coalesce(m.shop_price_min, m.ai_estimate_min, 0) as job_value,
    coalesce(m.booked_at, now()) as booked_at
  into v_row
  from public.shop_lead_matches m
  where m.id = p_match_id;

  if v_row.id is null then
    return null;
  end if;

  v_job_value := greatest(coalesce(v_row.job_value, 0), 0);
  v_commission := round(v_job_value * 0.10);

  insert into public.commission_ledger (
    match_id, lead_id, bodyshop_id, job_value, commission_rate, commission_amount, status, booked_at
  ) values (
    v_row.id, v_row.lead_id, v_row.bodyshop_id, v_job_value, 0.10, v_commission, 'pending', v_row.booked_at
  )
  on conflict (match_id) do update set
    job_value = excluded.job_value,
    commission_amount = excluded.commission_amount,
    booked_at = coalesce(public.commission_ledger.booked_at, excluded.booked_at),
    updated_at = now()
  returning id into v_ledger_id;

  return v_ledger_id;
end;
$$;

-- Patch booking RPC to create pending commission entry
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

  if v_match_status <> 'quoted' then
    raise exception 'Booking is only available after the bodyshop sends a quote. Current status: %.', v_match_status;
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

  perform public.upsert_commission_on_booking(v_match_id);

  if p_preferred_date is not null then
    v_period := public.label_to_period(p_preferred_time);
    v_reserved := public.reserve_bodyshop_slot(p_bodyshop_id, p_preferred_date, v_period);
  end if;

  perform public.append_lead_event(
    p_lead_id, p_bodyshop_id, 'booking_confirmed',
    'Customer confirmed booking with quoted bodyshop' || case when p_preferred_date is not null
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

create or replace function public.complete_partner_job(
  p_bodyshop_id uuid,
  p_lead_id uuid,
  p_final_job_value numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match record;
  v_lead record;
  v_shop record;
  v_job_value numeric;
  v_commission numeric;
  v_review_id uuid;
  v_token text;
  v_now timestamptz := now();
begin
  if not (
    p_bodyshop_id in (select public.partner_bodyshop_ids())
    or public.is_admin_user()
  ) then
    raise exception 'Not authorized to complete jobs for this bodyshop.';
  end if;

  select m.*, b.business_name
  into v_match
  from public.shop_lead_matches m
  join public.bodyshops b on b.id = m.bodyshop_id
  where m.lead_id = p_lead_id
    and m.bodyshop_id = p_bodyshop_id
  limit 1;

  if v_match.id is null then
    raise exception 'Lead is not assigned to this bodyshop.';
  end if;

  if v_match.status = 'completed' then
    raise exception 'Job already marked as completed.';
  end if;

  if v_match.status <> 'booked' then
    raise exception 'Only booked jobs can be marked as completed. Current status: %.', v_match.status;
  end if;

  select lr.customer_name, lr.customer_email
  into v_lead
  from public.lead_requests lr
  where lr.id = p_lead_id;

  v_job_value := greatest(
    coalesce(p_final_job_value, v_match.shop_price_min, v_match.ai_estimate_min, 0),
    0
  );
  v_commission := round(v_job_value * 0.10);

  update public.lead_requests
  set status = 'completed', completed_at = v_now
  where id = p_lead_id;

  update public.shop_lead_matches
  set
    status = 'completed',
    completed_at = v_now,
    shop_price_min = v_job_value,
    shop_price_max = v_job_value
  where id = v_match.id;

  insert into public.commission_ledger (
    match_id, lead_id, bodyshop_id, job_value, commission_rate, commission_amount, status, booked_at, completed_at
  ) values (
    v_match.id, p_lead_id, p_bodyshop_id, v_job_value, 0.10, v_commission, 'earned',
    coalesce(v_match.booked_at, v_now), v_now
  )
  on conflict (match_id) do update set
    job_value = excluded.job_value,
    commission_amount = excluded.commission_amount,
    status = 'earned',
    completed_at = excluded.completed_at,
    updated_at = v_now;

  insert into public.service_review_requests (
    match_id, lead_id, bodyshop_id, customer_email, customer_name, status, expires_at
  ) values (
    v_match.id,
    p_lead_id,
    p_bodyshop_id,
    v_lead.customer_email,
    v_lead.customer_name,
    'pending',
    v_now + interval '30 days'
  )
  on conflict (match_id) do nothing
  returning id, token into v_review_id, v_token;

  if v_review_id is null then
    select id, token
    into v_review_id, v_token
    from public.service_review_requests
    where match_id = v_match.id
    order by created_at desc
    limit 1;
  end if;

  perform public.append_lead_event(
    p_lead_id,
    p_bodyshop_id,
    'service_completed',
    'Bodyshop marked service as delivered — customer review requested',
    jsonb_build_object(
      'match_id', v_match.id,
      'job_value', v_job_value,
      'commission_amount', v_commission,
      'review_token', v_token
    )
  );

  return jsonb_build_object(
    'match_id', v_match.id,
    'lead_id', p_lead_id,
    'bodyshop_id', p_bodyshop_id,
    'bodyshop_name', v_match.business_name,
    'customer_email', v_lead.customer_email,
    'customer_name', v_lead.customer_name,
    'job_value', v_job_value,
    'commission_amount', v_commission,
    'review_token', v_token,
    'review_id', v_review_id
  );
end;
$$;

create or replace function public.get_service_review_by_token(p_token text)
returns table (
  valid boolean,
  expired boolean,
  already_submitted boolean,
  bodyshop_name text,
  customer_first_name text,
  rating smallint,
  review_comment text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select
    r.*,
    b.business_name as shop_name
  into v_row
  from public.service_review_requests r
  join public.bodyshops b on b.id = r.bodyshop_id
  where r.token = p_token
  limit 1;

  if v_row.id is null then
    return query select false, false, false, null::text, null::text, null::smallint, null::text;
    return;
  end if;

  return query select
    true,
    (v_row.expires_at < now()),
    (v_row.status = 'submitted'),
    v_row.shop_name,
    split_part(coalesce(v_row.customer_name, 'Customer'), ' ', 1),
    v_row.rating,
    v_row.review_comment;
end;
$$;

create or replace function public.submit_service_review(
  p_token text,
  p_rating smallint,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_now timestamptz := now();
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5.';
  end if;

  select r.*
  into v_row
  from public.service_review_requests r
  where r.token = p_token
  limit 1;

  if v_row.id is null then
    raise exception 'Invalid review link.';
  end if;

  if v_row.expires_at < v_now then
    update public.service_review_requests set status = 'expired' where id = v_row.id;
    raise exception 'This review link has expired.';
  end if;

  if v_row.status = 'submitted' then
    raise exception 'Review already submitted.';
  end if;

  update public.service_review_requests
  set
    status = 'submitted',
    rating = p_rating,
    review_comment = nullif(trim(p_comment), ''),
    submitted_at = v_now
  where id = v_row.id;

  perform public.append_lead_event(
    v_row.lead_id,
    v_row.bodyshop_id,
    'service_reviewed',
    'Customer submitted a ' || p_rating || '-star service review',
    jsonb_build_object('rating', p_rating, 'review_id', v_row.id)
  );

  return jsonb_build_object(
    'ok', true,
    'rating', p_rating,
    'lead_id', v_row.lead_id,
    'bodyshop_id', v_row.bodyshop_id
  );
end;
$$;

create or replace function public.mark_service_review_email_sent(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.service_review_requests
  set status = 'sent', email_sent_at = now()
  where token = p_token
    and status in ('pending', 'sent');
end;
$$;

-- Backfill commission rows for existing booked jobs
insert into public.commission_ledger (
  match_id, lead_id, bodyshop_id, job_value, commission_rate, commission_amount, status, booked_at
)
select
  m.id,
  m.lead_id,
  m.bodyshop_id,
  greatest(coalesce(m.shop_price_min, m.ai_estimate_min, 0), 0),
  0.10,
  round(greatest(coalesce(m.shop_price_min, m.ai_estimate_min, 0), 0) * 0.10),
  'pending',
  coalesce(m.booked_at, m.created_at)
from public.shop_lead_matches m
where m.status = 'booked'
on conflict (match_id) do nothing;

grant execute on function public.complete_partner_job(uuid, uuid, numeric) to authenticated;
grant execute on function public.get_service_review_by_token(text) to anon, authenticated;
grant execute on function public.submit_service_review(text, smallint, text) to anon, authenticated;
grant execute on function public.mark_service_review_email_sent(text) to authenticated, service_role;
