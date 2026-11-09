-- Step 4: Warframe Market session tokens + link from a riven to its WFM listing.

-- We NEVER store the user's WFM password. Only the session token (a JWT), AES-256-GCM
-- encrypted by the server with WFM_TOKEN_ENCRYPTION_KEY, bound to the user id as AAD.
-- RLS is enabled with NO policies: neither the anon nor authenticated role can read or
-- write this table; only server code using the service-role key can.
create table if not exists public.wfm_sessions (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  token_enc     text not null,
  wfm_name      text,                 -- WFM in-game name (display only)
  wfm_slug      text,
  expires_at    timestamptz,          -- from the JWT `exp` claim, if present
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
alter table public.wfm_sessions enable row level security;

alter table public.rivens add column if not exists wfm_auction_id text;
alter table public.rivens add column if not exists wfm_listed_at  timestamptz;
alter table public.rivens add column if not exists wfm_price       int;
