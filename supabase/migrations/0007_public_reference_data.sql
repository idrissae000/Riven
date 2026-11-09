-- Sign-in is optional: anonymous visitors can use the checker and browse arcanes, so the public
-- game reference data must be readable without an account. User data (rivens) and server-only
-- tables (market_cache, wfm_sessions) stay locked.
grant select on public.weapons, public.riven_attributes, public.riven_grade_ranges, public.arcanes to anon;

create policy "weapons public read"          on public.weapons          for select to anon using (true);
create policy "riven_attributes public read" on public.riven_attributes for select to anon using (true);
create policy "riven_grade_ranges public read" on public.riven_grade_ranges for select to anon using (true);
create policy "arcanes public read"          on public.arcanes          for select to anon using (true);
