-- last good world-state copy (server only)
create table if not exists public.world_state_cache (id text primary key, data jsonb not null, fetched_at timestamptz not null);
alter table public.world_state_cache enable row level security;
revoke all on public.world_state_cache from anon, authenticated;

-- every Varzia rotation's stock (public read, service-role write), so past rotations can be tracked after she leaves
create table if not exists public.varzia_items (
  visit text not null, ends text, name text not null, regal int, aya int, slug text, set_name text,
  primary key (visit, name)
);
alter table public.varzia_items enable row level security;
revoke all on public.varzia_items from anon, authenticated;
grant select on public.varzia_items to anon, authenticated;
create policy "varzia_items public read" on public.varzia_items for select to anon, authenticated using (true);

-- a user's watchlist of prime parts / sets / arcanes
create table if not exists public.watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null, kind text not null check (kind in ('prime', 'arcane')), name text not null, added_at timestamptz not null default now(),
  primary key (user_id, slug)
);
alter table public.watchlist enable row level security;
revoke all on public.watchlist from anon;
grant select, insert, update, delete on public.watchlist to authenticated;
create policy "own watch select" on public.watchlist for select to authenticated using (user_id = (select auth.uid()));
create policy "own watch insert" on public.watchlist for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own watch delete" on public.watchlist for delete to authenticated using (user_id = (select auth.uid()));

-- one row a day per user: what their holdings were worth (written when they open My portfolio)
create table if not exists public.portfolio_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null, total int not null, parts int not null default 0, arcanes int not null default 0, rivens int not null default 0, items int not null default 0,
  primary key (user_id, day)
);
alter table public.portfolio_snapshots enable row level security;
revoke all on public.portfolio_snapshots from anon;
grant select, insert, update, delete on public.portfolio_snapshots to authenticated;
create policy "own snap select" on public.portfolio_snapshots for select to authenticated using (user_id = (select auth.uid()));
create policy "own snap insert" on public.portfolio_snapshots for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own snap update" on public.portfolio_snapshots for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
