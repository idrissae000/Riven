-- Real riven grading data, extracted from the Codex Riven Calculator by `npm run sync:codex-riven`:
-- base stat table per weapon category, layout multipliers, roll range, grade bands, weapon categories.
-- Replaces the placeholder riven_grade_ranges table (ranges are now computed from this data).
create table if not exists public.riven_grading_data (
  id        text primary key,            -- 'codex'
  data      jsonb not null,              -- see src/lib/codex/types.ts (CodexRivenData)
  synced_at timestamptz not null default now()
);
alter table public.riven_grading_data enable row level security;
grant select on public.riven_grading_data to anon, authenticated;
create policy "riven_grading_data public read" on public.riven_grading_data for select to anon, authenticated using (true);
-- writes: service role only (the sync script).

drop table if exists public.riven_grade_ranges;
