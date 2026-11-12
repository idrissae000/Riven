-- 90 days of real, closed-trade history per item (daily average / low / high price and units sold), copied from Warframe
-- Market's statistics endpoint by /api/history/refresh. history_sync records when each item was last copied.
-- Public read, service-role write.
create table if not exists public.sales_history (
  slug       text not null,
  day        date not null,
  avg_price  numeric(8,1) not null,
  min_price  numeric(8,1),
  max_price  numeric(8,1),
  volume     int not null default 0,
  primary key (slug, day)
);
create table if not exists public.history_sync (
  slug       text primary key,
  synced_at  timestamptz not null
);
alter table public.sales_history enable row level security;
alter table public.history_sync enable row level security;
revoke all on public.sales_history, public.history_sync from anon, authenticated;
grant select on public.sales_history, public.history_sync to anon, authenticated;
create policy "sales_history public read" on public.sales_history for select to anon, authenticated using (true);
create policy "history_sync public read" on public.history_sync for select to anon, authenticated using (true);
