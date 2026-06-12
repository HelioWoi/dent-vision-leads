-- Ensure customer (anon) flow can insert leads and matches

drop policy if exists "Public insert lead_requests" on public.lead_requests;
create policy "Public insert lead_requests"
  on public.lead_requests for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public insert shop_lead_matches" on public.shop_lead_matches;
create policy "Public insert shop_lead_matches"
  on public.shop_lead_matches for insert
  to anon, authenticated
  with check (true);
