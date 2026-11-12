-- Per item: weekly average price paid over the last 90 days (oldest first, volume-weighted) plus the averages for the
-- last week, ~30 days ago and ~90 days ago. Lets list pages show 90-day trends without shipping every daily row.
create or replace function public.price_trends()
returns table(slug text, weekly numeric[], p7 numeric, p30 numeric, p90 numeric)
language sql stable
as $$
  with s as (
    select h.slug, ((current_date - h.day) / 7) as b,
           sum(h.avg_price * greatest(h.volume, 1)) / sum(greatest(h.volume, 1)) as w
    from public.sales_history h
    where h.day >= current_date - 90
    group by h.slug, ((current_date - h.day) / 7)
  )
  select s.slug,
         array_agg(round(s.w, 1) order by s.b desc),
         round(max(s.w) filter (where s.b = 0), 1),
         round(max(s.w) filter (where s.b = 4), 1),
         round(max(s.w) filter (where s.b = 12), 1)
  from s group by s.slug
$$;
grant execute on function public.price_trends() to anon, authenticated;
