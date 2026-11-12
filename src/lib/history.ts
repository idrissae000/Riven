export interface HistoryPoint { day: string; price: number }
export interface Trend {
  /** Oldest → newest prices, for the chart. */
  prices: number[];
  /** Percent change from the price ~7 days ago (or the oldest we have) to now. */
  changePct: number;
  /** How many days that change spans. */
  days: number;
  dir: "up" | "down" | "flat";
}

/** Anything under this many percent is "flat" — asking prices wobble by a platinum or two. */
const FLAT_PCT = 5;

/** Reduces daily points (any order) to a chart + 7-day change. Null until there are two days of data. */
export function trendOf(points: HistoryPoint[] | undefined, windowDays = 7): Trend | null {
  if (!points || points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const last = sorted[sorted.length - 1];
  const cutoff = Date.parse(last.day) - windowDays * 86_400_000;
  const base = sorted.find((p) => Date.parse(p.day) >= cutoff) ?? sorted[0];
  if (base === last || base.price <= 0) return null;
  const changePct = Math.round(((last.price - base.price) / base.price) * 100);
  return { prices: sorted.map((p) => p.price), changePct, days: Math.round((Date.parse(last.day) - Date.parse(base.day)) / 86_400_000), dir: Math.abs(changePct) < FLAT_PCT ? "flat" : changePct > 0 ? "up" : "down" };
}
