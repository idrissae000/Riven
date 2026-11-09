-- Step 3: per-stat grading.

-- Some stats are beneficial when NEGATIVE (e.g. Weapon Recoil). Set from
-- data/riven-attribute-overrides.json by the sync script.
alter table public.riven_attributes add column if not exists inverted boolean not null default false;

-- Min/max roll for one stat on one weapon, at MAX RANK (rank 8), as displayed in game
-- and SIGNED (min_roll <= max_roll numerically). Separate rows for the beneficial roll
-- (is_negative = false) and the curse roll (is_negative = true) of the same stat.
--
--   weapon_slug = '*'  -> default for every weapon without a specific row
--                         (Riven Disposition was retired; all weapons share one range).
--
-- >>> Rows with is_placeholder = true are STAND-INS and must be replaced. <<<
-- Load real data with:  npm run import:grading -- path/to/ranges.csv|json
create table if not exists public.riven_grade_ranges (
  weapon_slug    text    not null,                 -- weapons.slug or '*'
  stat_slug      text    not null references public.riven_attributes(slug),
  is_negative    boolean not null default false,
  min_roll       numeric not null,
  max_roll       numeric not null,
  is_placeholder boolean not null default true,
  source         text,
  updated_at     timestamptz not null default now(),
  primary key (weapon_slug, stat_slug, is_negative),
  check (min_roll <= max_roll)
);

alter table public.riven_grade_ranges enable row level security;
create policy "grade ranges readable" on public.riven_grade_ranges for select to authenticated using (true);
-- writes: service role only (import script).
