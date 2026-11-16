-- Auto-repricing (opt-in), its activity log, the stored accuracy/seasonality results, and the log of flagged buy-low deals.
create table if not exists public.autoprice_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  rule text not null default 'undercut' check (rule in ('undercut', 'match', 'market')),
  floor int not null default 1 check (floor >= 1),
  max_drop_pct int not null default 15 check (max_drop_pct between 1 and 50),
  last_run_at timestamptz,
  note text,
  updated_at timestamptz not null default now()
);
alter table public.autoprice_settings enable row level security;
revoke all on public.autoprice_settings from anon;
grant select, insert, update, delete on public.autoprice_settings to authenticated;
create policy "own autoprice select" on public.autoprice_settings for select to authenticated using (user_id = (select auth.uid()));
create policy "own autoprice insert" on public.autoprice_settings for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own autoprice update" on public.autoprice_settings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own autoprice delete" on public.autoprice_settings for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.autoprice_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id text not null, item_name text not null, old_price int not null, new_price int not null, cheapest int, note text,
  at timestamptz not null default now()
);
create index if not exists autoprice_log_user_idx on public.autoprice_log (user_id, at desc);
alter table public.autoprice_log enable row level security;
revoke all on public.autoprice_log from anon, authenticated;
grant select on public.autoprice_log to authenticated;
create policy "own autoprice log" on public.autoprice_log for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.accuracy_stats (key text primary key, data jsonb not null, computed_at timestamptz not null default now());
alter table public.accuracy_stats enable row level security;
revoke all on public.accuracy_stats from anon, authenticated;
grant select on public.accuracy_stats to anon, authenticated;
create policy "accuracy public read" on public.accuracy_stats for select to anon, authenticated using (true);

create table if not exists public.prediction_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null, slug text not null, name text not null, made_on date not null,
  ask numeric not null, normal numeric not null, typical numeric not null,
  unique (kind, slug, made_on)
);
alter table public.prediction_log enable row level security;
revoke all on public.prediction_log from anon, authenticated;
grant select on public.prediction_log to anon, authenticated;
create policy "prediction_log public read" on public.prediction_log for select to anon, authenticated using (true);
