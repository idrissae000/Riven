-- One price per item per day (the latest the refreshers saw that day), so the app can draw trends. Arcanes store their
-- effective unranked price (average of the 5 cheapest listings, or max-rank ÷ copies); Prime parts store avg5.
-- Public read, service-role write (written by the same price refreshers as arcane_prices / item_prices).
create table if not exists public.price_history (
  slug      text not null,
  day       date not null default (now() at time zone 'utc')::date,
  price     numeric(8,1) not null,
  listings  int not null default 0,
  primary key (slug, day)
);
alter table public.price_history enable row level security;
revoke all on public.price_history from anon, authenticated;
grant select on public.price_history to anon, authenticated;
create policy "price_history public read" on public.price_history for select to anon, authenticated using (true);
