-- What a user has sold (entered by hand, or detected from their Warframe Market orders and confirmed).
create table if not exists public.sales_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_name   text not null,
  slug        text,                                   -- Warframe Market slug when known
  qty         int  not null check (qty between 1 and 9999),
  price_each  int  not null check (price_each between 1 and 99999999),
  sold_at     timestamptz not null default now(),
  source      text not null default 'manual' check (source in ('manual', 'detected')),
  status      text not null default 'confirmed' check (status in ('confirmed', 'pending', 'dismissed')),
  created_at  timestamptz not null default now()
);
create index if not exists sales_log_user_idx on public.sales_log (user_id, sold_at desc);

-- The user's sell orders as we last saw them, to notice ones that vanished or shrank (probable sales).
create table if not exists public.order_snapshots (
  user_id   uuid not null references auth.users(id) on delete cascade,
  order_id  text not null,
  slug      text not null,
  name      text not null,
  rank      int  not null default 0,
  qty       int  not null,
  price     int  not null,
  seen_at   timestamptz not null default now(),
  primary key (user_id, order_id)
);

alter table public.sales_log enable row level security;
alter table public.order_snapshots enable row level security;
revoke all on public.sales_log, public.order_snapshots from anon;
grant select, insert, update, delete on public.sales_log, public.order_snapshots to authenticated;
create policy "own sales select" on public.sales_log for select to authenticated using (user_id = (select auth.uid()));
create policy "own sales insert" on public.sales_log for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own sales update" on public.sales_log for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own sales delete" on public.sales_log for delete to authenticated using (user_id = (select auth.uid()));
create policy "own snapshots select" on public.order_snapshots for select to authenticated using (user_id = (select auth.uid()));
create policy "own snapshots insert" on public.order_snapshots for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own snapshots update" on public.order_snapshots for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own snapshots delete" on public.order_snapshots for delete to authenticated using (user_id = (select auth.uid()));
