-- Step 2: shared cache for Warframe Market responses (10-15 min TTL enforced in code).
-- Service-role only: RLS is enabled with NO policies, so clients can never read or write it.
create table if not exists public.market_cache (
  key         text primary key,                -- "<api version>:<path?query>"
  payload     jsonb not null,
  fetched_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists market_cache_expires_idx on public.market_cache (expires_at);
alter table public.market_cache enable row level security;
