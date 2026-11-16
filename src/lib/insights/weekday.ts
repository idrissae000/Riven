import type { SalesDay } from "@/lib/history-sales";

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DAY = 86_400_000;
const dow = (day: string) => new Date(day + "T00:00:00Z").getUTCDay();

export interface DayDev { dow: number; price: number | null; volume: number | null }

/**
 * For each complete day: how far its price and its volume sat from the average of the 7 days centred on it (itself, 3 before, 3 after), as a fraction.
 * Every such window holds each weekday once, so the baseline is the same for all weekdays and trends are removed: what's left is the day-of-week pattern
 * relative to the week's average. Needs all 7 days present.
 */
export function dayDeviations(sales: SalesDay[], today: string): DayDev[] {
  const by = new Map(sales.filter((s) => s.day < today).map((s) => [s.day, s]));
  const out: DayDev[] = [];
  for (const s of by.values()) {
    const t = Date.parse(s.day + "T00:00:00Z");
    const near: SalesDay[] = [];
    for (let k = -3; k <= 3; k++) { const n = by.get(new Date(t + k * DAY).toISOString().slice(0, 10)); if (n) near.push(n); }
    if (near.length < 7) continue;
    const mp = near.reduce((a, r) => a + r.avg, 0) / near.length, mv = near.reduce((a, r) => a + r.volume, 0) / near.length;
    out.push({ dow: dow(s.day), price: mp > 0 ? s.avg / mp - 1 : null, volume: mv > 0 ? s.volume / mv - 1 : null });
  }
  return out;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Two-sided exact sign-test p-value: `k` of `n` independent days on one side, when each side is equally likely by chance. */
export function signTestP(k: number, n: number): number {
  if (n === 0) return 1;
  const hi = Math.max(k, n - k);
  let p = 0, c = 1; // c = C(n, i)
  const binom: number[] = [1];
  for (let i = 1; i <= n; i++) { c = (c * (n - i + 1)) / i; binom.push(c); }
  for (let i = hi; i <= n; i++) p += binom[i];
  return Math.min(1, (2 * p) / 2 ** n);
}

export interface ItemWeekday { dow: number; n: number; price: number | null; priceP: number; volume: number | null; volumeP: number }

/** One item's pattern per weekday: the average deviation, and how consistent it was (sign test across that weekday's occurrences). */
export function itemWeekdays(sales: SalesDay[], today: string): ItemWeekday[] {
  const devs = dayDeviations(sales, today);
  return WEEKDAYS.map((_, d) => {
    const rows = devs.filter((x) => x.dow === d);
    const pr = rows.flatMap((r) => (r.price == null ? [] : [r.price])), vo = rows.flatMap((r) => (r.volume == null ? [] : [r.volume]));
    return {
      dow: d, n: rows.length,
      price: pr.length ? Math.round(mean(pr) * 1000) / 10 : null, priceP: signTestP(pr.filter((x) => x > 0).length, pr.filter((x) => x !== 0).length),
      volume: vo.length ? Math.round(mean(vo) * 1000) / 10 : null, volumeP: signTestP(vo.filter((x) => x > 0).length, vo.filter((x) => x !== 0).length),
    };
  });
}

export interface MarketWeekday { dow: number; items: number; price: number; priceLo: number; priceHi: number; volume: number; volumeLo: number; volumeHi: number }

/** Across many items: each item's average deviation for a weekday, then the mean of those with a 95% interval (items are the independent samples). */
export function marketWeekdays(perItem: ItemWeekday[][]): MarketWeekday[] {
  return WEEKDAYS.map((_, d) => {
    const pick = (f: (w: ItemWeekday) => number | null) => perItem.flatMap((w) => { const v = f(w[d]); return w[d].n >= 6 && v != null ? [v] : []; });
    const stat = (xs: number[]) => {
      if (xs.length < 2) return { m: 0, lo: 0, hi: 0 };
      const m = mean(xs), sd = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1)), se = sd / Math.sqrt(xs.length);
      return { m, lo: m - 1.96 * se, hi: m + 1.96 * se };
    };
    const p = stat(pick((w) => w.price)), v = stat(pick((w) => w.volume));
    const r = (x: number) => Math.round(x * 10) / 10;
    return { dow: d, items: pick((w) => w.price).length, price: r(p.m), priceLo: r(p.lo), priceHi: r(p.hi), volume: r(v.m), volumeLo: r(v.lo), volumeHi: r(v.hi) };
  });
}

/** A weekday effect is only called real when its whole 95% interval is on one side of zero and the effect isn't trivial. */
export const isReal = (m: number, lo: number, hi: number, minPct: number) => (lo > 0 || hi < 0) && Math.abs(m) >= minPct;
