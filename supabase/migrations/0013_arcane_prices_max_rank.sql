-- Max-rank prices, so an arcane whose rank-0 market is too thin to trust can be priced as
-- (max-rank price ÷ the copies a max-rank arcane takes: 21 for rank 5, 10 for rank 3).
alter table public.arcane_prices
  add column if not exists max_avg5     numeric(8,1),   -- average of the 5 cheapest online max-rank sell listings
  add column if not exists max_low      int,            -- cheapest online max-rank listing
  add column if not exists max_listings int not null default 0;
