-- per item: its usual sold price over 30 days (median of daily averages), what it sold for in the last 3 days and the 3 before, and units/day
create or replace function public.price_levels()
returns table(slug text, typical numeric, recent numeric, prev numeric, per_day numeric, days int)
language sql stable security invoker set search_path = public as $$
  select s.slug,
    percentile_cont(0.5) within group (order by s.avg_price)::numeric,
    (sum(s.avg_price * s.volume) filter (where s.day >= current_date - 3) / nullif(sum(s.volume) filter (where s.day >= current_date - 3), 0))::numeric,
    (sum(s.avg_price * s.volume) filter (where s.day >= current_date - 6 and s.day < current_date - 3) / nullif(sum(s.volume) filter (where s.day >= current_date - 6 and s.day < current_date - 3), 0))::numeric,
    (coalesce(sum(s.volume) filter (where s.day >= current_date - 14), 0) / 14.0)::numeric,
    count(*)::int
  from public.sales_history s
  where s.day >= current_date - 30 and s.day < current_date
  group by s.slug
$$;
grant execute on function public.price_levels() to anon, authenticated;

-- what the user paid per unit for a holding (blank = unknown)
alter table public.inventory_items add column if not exists cost_each int check (cost_each is null or cost_each between 0 and 99999999);
