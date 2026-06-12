-- Admin "FOR ALL" policies default to role PUBLIC, which blocks anon inserts
-- even when a separate public insert policy exists. Scope admin policies to authenticated.

drop policy if exists "Admin manage lead requests" on public.lead_requests;
create policy "Admin manage lead requests"
  on public.lead_requests for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "Admin manage shop lead matches" on public.shop_lead_matches;
create policy "Admin manage shop lead matches"
  on public.shop_lead_matches for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());
