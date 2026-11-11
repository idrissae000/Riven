-- Per-weapon riven market summary (from the cheapest buy-it-now listings), shared by everyone and refreshed in
-- small batches by /api/weapons/prices/refresh (service role). Public read, service-role write.
create table if not exists public.weapon_riven_prices (
  slug        text primary key references public.weapons(slug) on delete cascade,
  listings    int  not null default 0,     -- usable listings looked at (the search returns ~99 at most)
  saturated   boolean not null default false,
  low         int,                         -- cheapest listing
  median      int,                         -- median asking price: the ranking number
  p75         int,
  stats       jsonb not null default '[]', -- [{stat, withMedian, withoutMedian, n}] stats that ask more
  fetched_at  timestamptz
);
alter table public.weapon_riven_prices enable row level security;
revoke all on public.weapon_riven_prices from anon, authenticated;
grant select on public.weapon_riven_prices to anon, authenticated;
create policy "weapon_riven_prices public read" on public.weapon_riven_prices for select to anon, authenticated using (true);
