-- What a signed-in user owns (Prime parts / sets and arcanes), so the app can total its worth and say what to sell.
create table if not exists public.inventory_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('prime', 'arcane')),
  slug        text not null,                       -- Warframe Market item slug
  rank        int  not null default 0 check (rank between 0 and 10),  -- arcanes: 0 = unranked, otherwise max rank
  qty         int  not null check (qty between 1 and 9999),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, kind, slug, rank)
);
create index if not exists inventory_items_user_idx on public.inventory_items (user_id);

alter table public.inventory_items enable row level security;
revoke all on public.inventory_items from anon;
grant select, insert, update, delete on public.inventory_items to authenticated;
create policy "own inventory select" on public.inventory_items for select to authenticated using (user_id = (select auth.uid()));
create policy "own inventory insert" on public.inventory_items for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own inventory update" on public.inventory_items for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own inventory delete" on public.inventory_items for delete to authenticated using (user_id = (select auth.uid()));
create trigger inventory_items_touch before update on public.inventory_items for each row execute function public.touch_updated_at();
