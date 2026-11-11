-- Last market estimate per riven, so My Rivens can show a price on every card (and a vault total) instantly and
-- refresh in the background. Written by the market route with the owner's own session (RLS: own rows only).
alter table public.rivens
  add column if not exists est_low        int,
  add column if not exists est_median     int,
  add column if not exists est_high       int,
  add column if not exists est_confidence text,
  add column if not exists est_samples    int,
  add column if not exists est_at         timestamptz;  -- when we last tried (null estimate + a date = "no estimate")
