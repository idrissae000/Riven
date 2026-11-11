-- Arcane market prices (rank 0) shared by everyone, and Loid's Arcane Collections ("Vosfor packs").
-- Prices are refreshed in small batches by /api/arcanes/prices/refresh (service role) and by
-- `npm run sync:arcane-prices`; collections come from `npm run sync:wiki-arcanes`. Public read, service-role write.
create table if not exists public.arcane_prices (
  slug          text primary key references public.arcanes(slug) on delete cascade,
  low           int,                       -- cheapest online rank-0 sell listing
  avg5          numeric(8,1),              -- average of the (up to) 5 cheapest online rank-0 sell listings
  listings      int not null default 0,    -- how many listings that average is of (0-5)
  fetched_at    timestamptz,               -- when low/avg5 were last fetched (null = never)
  volume_48h    int,                       -- rank-0 units sold in the last 48h
  sold_avg_48h  numeric(8,1),              -- volume-weighted average sale price over those 48h
  stats_at      timestamptz                -- when the sales stats were last fetched
);

create table if not exists public.arcane_collections (
  id          text primary key,            -- "eidolon"
  name        text not null,
  vosfor      int  not null,               -- Vosfor cost of one purchase
  credits     int  not null,
  picks       int  not null,               -- arcanes per purchase
  tiers       jsonb not null,              -- [{rarity, chance, arcanes: [arcane slug]}]
  wiki_revid  bigint,
  synced_at   timestamptz not null default now()
);

alter table public.arcane_prices      enable row level security;
alter table public.arcane_collections enable row level security;
revoke all on public.arcane_prices, public.arcane_collections from anon, authenticated;
grant select on public.arcane_prices, public.arcane_collections to anon, authenticated;
create policy "arcane_prices public read"      on public.arcane_prices      for select to anon, authenticated using (true);
create policy "arcane_collections public read" on public.arcane_collections for select to anon, authenticated using (true);
