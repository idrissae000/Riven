-- Least privilege: the app is sign-in only, so anon needs nothing; server-only tables
-- (market cache, encrypted WFM tokens) are reachable only via the service role.
revoke all on all tables in schema public from anon;
revoke all on public.market_cache, public.wfm_sessions from authenticated;
