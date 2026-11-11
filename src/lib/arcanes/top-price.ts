/** Reduces Warframe Market responses to the few numbers the arcane price table stores. Pure, no I/O. */

export interface TopOrder {
  type?: string; platinum: number; quantity?: number; rank?: number; visible?: boolean;
  user?: { status?: string; platform?: string; crossplay?: boolean };
}

export interface TopPrice {
  /** Cheapest online rank-0 sell listing. */
  low: number | null;
  /** Average of the (up to) five cheapest online rank-0 sell listings — the arcane's price everywhere in the app. */
  avg5: number | null;
  /** How many listings that average is of (0–5). Fewer than 3 = a thin market. */
  listings: number;
}

const online = (s?: string) => s === "ingame" || s === "online";

/** From `GET /v2/orders/item/{slug}/top?rank=N` (its `data.sell` list); `rank` is the rank the listings must be at (0 = unranked). */
export function reduceTopOrders(sell: TopOrder[] | null | undefined, cheapest = 5, rank = 0): TopPrice {
  const ok = (sell ?? [])
    .filter((o) => (o.type ?? "sell") === "sell" && o.visible !== false && (o.quantity ?? 1) > 0 && (o.rank ?? 0) === rank && online(o.user?.status) && (o.user?.platform === "pc" || o.user?.crossplay === true || o.user?.platform === undefined))
    .map((o) => o.platinum)
    .filter((p) => Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b)
    .slice(0, cheapest);
  if (!ok.length) return { low: null, avg5: null, listings: 0 };
  return { low: ok[0], avg5: Math.round((ok.reduce((a, b) => a + b, 0) / ok.length) * 10) / 10, listings: ok.length };
}

export interface SoldStats {
  /** Units sold at rank 0 in the last 48 hours. */
  volume48h: number;
  /** Volume-weighted average sale price over those 48 hours. */
  soldAvg48h: number | null;
}

interface StatRow { volume?: number; avg_price?: number; mod_rank?: number }

/** From `GET /v1/items/{slug}/statistics` (`payload.statistics_closed["48hours"]`): rank-0 rows only (rows without a rank count as rank 0). */
export function reduceSold(rows: StatRow[] | null | undefined): SoldStats | null {
  const r0 = (rows ?? []).filter((r) => (r.mod_rank ?? 0) === 0 && typeof r.volume === "number");
  if (!r0.length) return null;
  const volume = r0.reduce((s, r) => s + (r.volume ?? 0), 0);
  const weighted = r0.reduce((s, r) => s + (r.volume ?? 0) * (r.avg_price ?? 0), 0);
  return { volume48h: volume, soldAvg48h: volume > 0 ? Math.round((weighted / volume) * 10) / 10 : null };
}

/** Which rows to refresh next: never-fetched first, then the oldest, skipping anything younger than `ttlMs`. */
export function pickStale<T extends { slug: string }>(rows: T[], fetchedAt: (r: T) => string | null | undefined, now: number, ttlMs: number, limit: number): T[] {
  return rows
    .map((r) => ({ r, t: fetchedAt(r) ? Date.parse(fetchedAt(r) as string) : -Infinity }))
    .filter((x) => !(now - x.t < ttlMs))
    .sort((a, b) => a.t - b.t || a.r.slug.localeCompare(b.r.slug))
    .slice(0, limit)
    .map((x) => x.r);
}
