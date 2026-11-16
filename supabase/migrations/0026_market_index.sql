-- A price index for a basket: the top `n` items (of the given slugs) by 30-day turnover, each item's price against its own start of the 90-day window, weighted by turnover. 100 = the start.
create or replace function public.market_index(slugs text[], n int default 60)
returns table(day date, idx numeric, items int)
language sql stable security invoker set search_path = public as $$
  with top as (
    select s.slug, sum(s.avg_price * s.volume) as turn
    from public.sales_history s
    where s.slug = any(slugs) and s.day >= current_date - 30 and s.day < current_date
    group by s.slug order by turn desc limit n
  ),
  base as (
    select s.slug, avg(s.avg_price) as p0
    from public.sales_history s join top t on t.slug = s.slug
    where s.day >= current_date - 89 and s.day < current_date - 82
    group by s.slug having count(*) >= 4
  ),
  days as (select generate_series(current_date - 89, current_date - 1, interval '1 day')::date as day),
  px as (
    select d.day, b.slug, t.turn, b.p0,
      (select s.avg_price from public.sales_history s where s.slug = b.slug and s.day <= d.day and s.day > d.day - 7 order by s.day desc limit 1) as p
    from days d cross join base b join top t on t.slug = b.slug
  )
  select px.day, round((100 * sum(px.turn * px.p / px.p0) / nullif(sum(px.turn) filter (where px.p is not null), 0))::numeric, 2), count(*) filter (where px.p is not null)::int
  from px group by px.day order by px.day
$$;
grant execute on function public.market_index(text[], int) to anon, authenticated;
