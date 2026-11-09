-- Step 1: reference data (synced from Warframe Market) + user-owned rivens.

-- Reference: riven-capable weapons. Populated by `npm run sync:wfm-static`.
create table if not exists public.weapons (
  slug            text primary key,            -- WFM slug, e.g. "soma"
  name            text not null,
  riven_type      text not null,               -- rifle | pistol | shotgun | melee | archgun | kitgun | zaw
  group_name      text,                        -- primary | secondary | melee | ...
  disposition     numeric(4,2),
  req_mastery     int,
  icon            text,
  synced_at       timestamptz not null default now()
);

-- Reference: riven stat definitions (WFM "riven attributes").
create table if not exists public.riven_attributes (
  slug            text primary key,            -- e.g. "critical_damage"
  name            text not null,               -- e.g. "Critical Damage"
  unit            text,                        -- percent | seconds | multiplier | null
  exclusive_to    text[],                      -- riven types this stat can roll on (null = all)
  positive_only   boolean not null default false,
  prefix          text,
  suffix          text,
  synced_at       timestamptz not null default now()
);

-- A user's riven. `stats` = [{ "stat": "critical_damage", "value": 112.3, "is_negative": false }, ...]
-- (signed values: negative stats are stored negative). jsonb keeps the insert atomic and
-- is easy to open up to community aggregation later.
create table if not exists public.rivens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  weapon_slug   text not null references public.weapons(slug),
  riven_name    text,                          -- e.g. "Acria-da" (prefix + suffix)
  polarity      text not null check (polarity in ('madurai','vazarin','naramon','zenurik')),
  mastery_rank  int  not null check (mastery_rank between 8 and 16),
  rank          int  not null default 0 check (rank between 0 and 8),
  rerolls       int  not null default 0 check (rerolls >= 0),
  stats         jsonb not null,
  has_negative  boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists rivens_user_idx on public.rivens (user_id, created_at desc);

-- Row level security -------------------------------------------------------
alter table public.weapons          enable row level security;
alter table public.riven_attributes enable row level security;
alter table public.rivens           enable row level security;

-- Reference tables: anyone signed in may read; only the service role writes (no write policy).
create policy "weapons readable"          on public.weapons          for select to authenticated using (true);
create policy "riven_attributes readable" on public.riven_attributes for select to authenticated using (true);

create policy "own rivens select" on public.rivens for select to authenticated using (user_id = (select auth.uid()));
create policy "own rivens insert" on public.rivens for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rivens update" on public.rivens for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rivens delete" on public.rivens for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger rivens_touch before update on public.rivens
  for each row execute function public.touch_updated_at();
