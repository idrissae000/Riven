-- An earlier draft synced every ability to match arcanes by the stat they scale with. The real data is
-- the per-arcane "valid abilities" tables on each arcane's wiki page, now stored in arcanes.compatibility.
drop table if exists public.abilities;
