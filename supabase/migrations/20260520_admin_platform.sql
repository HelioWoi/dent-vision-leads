-- Dent-Vision AI Admin Platform schema scaffold
-- Safe migration: creates only missing objects (no destructive operations)

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'customer' check (role in ('admin', 'bodyshop', 'customer')),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.bodyshops (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  owner_name text,
  email text,
  phone text,
  address text,
  postal_code text,
  service_radius integer,
  latitude numeric,
  longitude numeric,
  region text,
  verified_status boolean not null default false,
  active_status boolean not null default true,
  notification_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bodyshop_owners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  bodyshop_id uuid references public.bodyshops(id) on delete set null,
  name text,
  email text,
  phone text,
  role text not null default 'owner',
  notification_preference text,
  active_status boolean not null default true,
  last_login timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_requests (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  customer_email text,
  customer_phone text,
  postal_code text,
  region text,
  photo_url text,
  ai_estimate_min numeric,
  ai_estimate_max numeric,
  ai_damage_category text,
  dent_count integer,
  dent_size text,
  damage_location text,
  ai_confidence_score numeric,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_lead_matches (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.lead_requests(id) on delete cascade,
  bodyshop_id uuid references public.bodyshops(id) on delete cascade,
  status text,
  ai_estimate_min numeric,
  ai_estimate_max numeric,
  shop_price_min numeric,
  shop_price_max numeric,
  shop_note text,
  response_deadline timestamptz,
  responded_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  bodyshop_id uuid references public.bodyshops(id) on delete cascade,
  owner_id uuid references public.bodyshop_owners(id) on delete cascade,
  push_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  dashboard_enabled boolean not null default true,
  primary_channel text,
  backup_channel text,
  response_deadline_seconds integer,
  retry_logic text,
  notification_radius integer,
  lead_categories_accepted text[],
  created_at timestamptz not null default now()
);

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  bodyshop_id uuid references public.bodyshops(id) on delete set null,
  owner_id uuid references public.bodyshop_owners(id) on delete set null,
  lead_id uuid references public.lead_requests(id) on delete set null,
  channel text,
  status text,
  message text,
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  failed_reason text
);

create table if not exists public.manual_reviews (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.lead_requests(id) on delete cascade,
  reason text,
  status text,
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.pricing_regions (
  id uuid primary key default gen_random_uuid(),
  region_name text not null,
  postal_codes text[],
  state text,
  country text,
  active_status boolean not null default true,
  linked_bodyshops uuid[],
  pricing_rule_reference text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.bodyshops enable row level security;
alter table public.bodyshop_owners enable row level security;
alter table public.lead_requests enable row level security;
alter table public.shop_lead_matches enable row level security;
alter table public.notification_settings enable row level security;
alter table public.notification_logs enable row level security;
alter table public.manual_reviews enable row level security;
alter table public.pricing_regions enable row level security;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
      and a.role = 'admin'
  );
$$;

do $$ begin
  create policy "Admin read all profiles"
    on public.profiles
    for select
    using (public.is_admin_user() or id = auth.uid());
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy "Admin manage admin_users"
    on public.admin_users
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy "Admin manage bodyshops"
    on public.bodyshops
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy "Admin manage bodyshop owners"
    on public.bodyshop_owners
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy "Admin manage lead requests"
    on public.lead_requests
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy "Admin manage shop lead matches"
    on public.shop_lead_matches
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy "Admin manage notification settings"
    on public.notification_settings
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy "Admin manage notification logs"
    on public.notification_logs
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy "Admin manage manual reviews"
    on public.manual_reviews
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy "Admin manage pricing regions"
    on public.pricing_regions
    for all
    using (public.is_admin_user())
    with check (public.is_admin_user());
exception
  when duplicate_object then null;
end $$;
