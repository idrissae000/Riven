-- Step 5: arcanes. Populated by `npm run sync:wiki-arcanes` (Warframe Wiki + Warframe Market),
-- so refreshing after a game update is a script re-run, not data entry.
create table if not exists public.arcanes (
  slug              text primary key,              -- "arcane_energize"
  name              text not null,
  slot              text not null,                 -- Warframe | Operator | Primary | Secondary | Melee | Amp | Zaw | Kitgun ...
  rarity            text,
  max_rank          int,
  description       text not null default '',      -- effect text (max rank) from the wiki
  effect_stats      jsonb not null default '[]',   -- [{key,label,category}] from the wiki's UpgradeTypes
  compatibility     jsonb not null default '{}',   -- structured: equips_on, scales_with, categories, ability_scaling, excludes, abilities[], playstyles[], notes[]
  drop_sources      jsonb not null default '[]',   -- [{text,kind,links[],details[]}]
  wiki_title        text not null,
  wiki_url          text not null,
  wiki_revid        bigint,                        -- wiki revision the page data came from
  wfm_slug          text,                          -- Warframe Market item slug (null = not tradable / unmatched)
  wfm_icon          text,
  introduced        text,
  needs_review      text[] not null default '{}',  -- gaps the sync could not fill
  overridden_fields text[] not null default '{}',  -- fields taken from data/arcane-overrides.json
  synced_at         timestamptz not null default now()
);
create index if not exists arcanes_slot_idx on public.arcanes (slot);

alter table public.arcanes enable row level security;
create policy "arcanes readable" on public.arcanes for select to authenticated using (true);
-- writes: service role only (sync script).
