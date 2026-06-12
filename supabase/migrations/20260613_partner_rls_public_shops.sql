-- Allow customer (anon) flow to read active bodyshops for lead routing
-- Allow partners to read their own bodyshop_owners row

do $$ begin
  create policy "Public read active bodyshops"
    on public.bodyshops for select
    to anon, authenticated
    using (active_status = true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Partners read own owner profile"
    on public.bodyshop_owners for select
    to authenticated
    using (
      user_id = auth.uid()
      or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      or public.is_admin_user()
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Partners update own owner profile"
    on public.bodyshop_owners for update
    to authenticated
    using (
      user_id = auth.uid()
      or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    with check (
      user_id = auth.uid()
      or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
exception when duplicate_object then null;
end $$;
