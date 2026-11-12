import type { SalesDay } from "./history-sales";

export interface AskingDay { day: string; price: number; listings?: number }
export interface ChartDay {
  day: string; t: number;
  sold: number | null; soldMin: number | null; soldMax: number | null; volume: number | null;
  asking: number | null;
}

const DAY = 86_400_000;
const t = (day: string) => Date.parse(day + "T00:00:00Z");

/** Merges the sales history and our own asking-price snapshots into one row per day, keeping only the last `days` days (relative to the newest point). */
export function mergeDays(sales: SalesDay[], asking: AskingDay[], days: number): ChartDay[] {
  const map = new Map<string, ChartDay>();
  const row = (day: string): ChartDay => map.get(day) ?? (map.set(day, { day, t: t(day), sold: null, soldMin: null, soldMax: null, volume: null, asking: null }), map.get(day)!);
  for (const s of sales) Object.assign(row(s.day), { sold: s.avg, soldMin: s.min, soldMax: s.max, volume: s.volume });
  for (const a of asking) row(a.day).asking = a.price;
  const all = [...map.values()].sort((a, b) => a.t - b.t);
  if (!all.length) return [];
  const cutoff = all[all.length - 1].t - (days - 1) * DAY;
  return all.filter((d) => d.t >= cutoff);
}

/** ~`count` round-number gridline values covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [Math.round(min * 10) / 10];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/** Index of the day whose x position is closest to `x` (xs ascending). */
export function nearestIndex(xs: number[], x: number): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
  return best;
}

export interface RangeStats { low: number | null; high: number | null; avg: number | null; units: number; changePct: number | null }

/** Headline numbers for the visible days, from real sales: lowest/highest price paid, volume-weighted average, units sold, first→last change. */
export function rangeStats(days: ChartDay[]): RangeStats {
  const sold = days.filter((d) => d.sold != null);
  const units = sold.reduce((s, d) => s + (d.volume ?? 0), 0);
  const lows = sold.map((d) => d.soldMin ?? d.sold!), highs = sold.map((d) => d.soldMax ?? d.sold!);
  const weighted = units > 0 ? sold.reduce((s, d) => s + d.sold! * (d.volume ?? 0), 0) / units : sold.length ? sold.reduce((s, d) => s + d.sold!, 0) / sold.length : null;
  const first = sold[0]?.sold, last = sold[sold.length - 1]?.sold;
  return {
    low: lows.length ? Math.min(...lows) : null, high: highs.length ? Math.max(...highs) : null,
    avg: weighted == null ? null : Math.round(weighted * 10) / 10, units,
    changePct: first && last && sold.length > 1 ? Math.round(((last - first) / first) * 100) : null,
  };
}
