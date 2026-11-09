-- Warframe abilities (from the wiki) so arcanes can list WHICH abilities they work with.
create table if not exists public.abilities (
  slug          text primary key,               -- "rhino_roar"
  name          text not null,
  warframe      text not null,                  -- owning Warframe / Necramech / Archwing
  key           int,                            -- ability slot 1-4
  cost          int,
  helminth      boolean not null default false, -- Helminth-subsumable (shown with a star)
  modifiers     text[] not null default '{}',   -- AVATAR_ABILITY_STRENGTH | _DURATION | _EFFICIENCY | _RANGE
  internal_name text,
  synced_at     timestamptz not null default now()
);
create index if not exists abilities_modifiers_idx on public.abilities using gin (modifiers);

alter table public.abilities enable row level security;
grant select on public.abilities to anon, authenticated;
create policy "abilities public read" on public.abilities for select to anon, authenticated using (true);
