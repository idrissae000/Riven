-- Market prices for Prime parts and sets (any Warframe Market item slug), shared by everyone and refreshed in small
-- batches by /api/primes/prices/refresh (service role). Public read, service-role write.
create table if not exists public.item_prices (
  slug        text primary key,           -- Warframe Market item slug, e.g. "frost_prime_chassis_blueprint"
  low         int,                        -- cheapest online sell listing
  avg5        numeric(8,1),               -- average of the (up to) 5 cheapest online sell listings
  listings    int not null default 0,     -- how many listings that average is of (0-5)
  fetched_at  timestamptz
);
alter table public.item_prices enable row level security;
revoke all on public.item_prices from anon, authenticated;
grant select on public.item_prices to anon, authenticated;
create policy "item_prices public read" on public.item_prices for select to anon, authenticated using (true);
