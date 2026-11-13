import { BARO_TTL_MS } from "./refresh";

/** How many of Baro's items still need their live price / history analysis (new stock, or older than the refresh interval). */
export function baroDue(
  stock: { item: string }[],
  rows: { name: string; wfm_slug: string | null; computed_at: string | null }[],
  now: number = Date.now(),
  ttlMs: number = BARO_TTL_MS,
): number {
  const have = new Map(rows.map((r) => [r.name, r]));
  return stock.filter((s) => { const r = have.get(s.item); return !r || (r.wfm_slug != null && !(r.computed_at && now - Date.parse(r.computed_at) < ttlMs)); }).length;
}
