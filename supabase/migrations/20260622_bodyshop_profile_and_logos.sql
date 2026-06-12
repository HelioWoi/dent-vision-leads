-- Bodyshop public profile: logo, website (address/phone/email already on bodyshops)

alter table public.bodyshops
  add column if not exists logo_url text,
  add column if not exists website text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bodyshop-logos',
  'bodyshop-logos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

do $$ begin
  create policy "Public read bodyshop logos"
    on storage.objects for select
    to anon, authenticated
    using (bucket_id = 'bodyshop-logos');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Partners upload own bodyshop logo"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'bodyshop-logos'
      and (storage.foldername(name))[1]::uuid in (select public.partner_bodyshop_ids())
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Partners update own bodyshop logo"
    on storage.objects for update
    to authenticated
    using (
      bucket_id = 'bodyshop-logos'
      and (storage.foldername(name))[1]::uuid in (select public.partner_bodyshop_ids())
    )
    with check (
      bucket_id = 'bodyshop-logos'
      and (storage.foldername(name))[1]::uuid in (select public.partner_bodyshop_ids())
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Partners delete own bodyshop logo"
    on storage.objects for delete
    to authenticated
    using (
      bucket_id = 'bodyshop-logos'
      and (storage.foldername(name))[1]::uuid in (select public.partner_bodyshop_ids())
    );
exception when duplicate_object then null;
end $$;
