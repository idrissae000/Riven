-- Baro Ki'Teer's stock for each visit, with the price analysis the /baro page shows. Filled by /api/baro/refresh.
-- Public read, service-role write.
create table if not exists public.baro_items (
  visit        text not null,                 -- the visit's arrival time (ISO), so every visit keeps its own rows
  name         text not null,                 -- as Baro lists it
  ducats       int,
  credits      int,
  wfm_slug     text,                          -- null = not tradable on Warframe Market (cosmetics, boosters, ...)
  price_now    numeric(8,1),                  -- average of the 5 cheapest online sell listings (unranked) right now
  listings     int not null default 0,
  ratio_short  numeric(6,3),
  ratio_long   numeric(6,3),
  dip_share    numeric(4,2),
  cycles       int not null default 0,
  confidence   text not null default 'none',
  computed_at  timestamptz,
  primary key (visit, name)
);
alter table public.baro_items enable row level security;
revoke all on public.baro_items from anon, authenticated;
grant select on public.baro_items to anon, authenticated;
create policy "baro_items public read" on public.baro_items for select to anon, authenticated using (true);

-- 0020b: the item's usual price in the week before Baro arrived (the anchor for the projections)
alter table public.baro_items add column if not exists pre_price numeric(8,1);
-- 0020c: records-only model keeps how many past visits came back to the usual price
alter table public.baro_items add column if not exists short_hits int not null default 0, add column if not exists short_n int not null default 0, add column if not exists long_hits int not null default 0, add column if not exists long_n int not null default 0;
