/**
 * What Baro Ki'Teer's visits have historically done to an item's price, from its daily closed-trade history.
 *
 * Baro arrives every 14 days and stays ~2 days; while he sells an item its price tends to dip, then recover. For each of the last
 * ~6 visits we compare the price on the days he was here (days 0–2 after arrival) with the price in two later windows:
 *   short = days 3–8  (the week after he leaves)
 *   long  = days 14–28 (two to four weeks out, past the next visit — the median shrugs off the few days of the next dip)
 * The typical ratio (median over visits) is applied to today's live price to project what a unit bought now might sell for.
 * It cannot know whether Baro actually sold the item in earlier visits, so it also reports how consistently the price dipped.
 */
export interface DayPrice { day: string; price: number }

const DAY = 86_400_000;
export const CYCLE_DAYS = 14;
export const SHORT_WINDOW: [number, number] = [3, 8];
export const LONG_WINDOW: [number, number] = [14, 28];
const RATIO_CLAMP: [number, number] = [0.5, 2.5];

export interface CycleStat { arrival: string; during: number | null; short: number | null; long: number | null }
export type Confidence = "strong" | "some" | "weak" | "none";
export interface BaroAnalysis {
  /** Past visits that had prices both while Baro was here and in the later windows. */
  cycles: number;
  /** Typical (median) price after the short / long windows relative to the price while Baro is here; null without enough history. */
  ratioShort: number | null;
  ratioLong: number | null;
  /** Share of visits where the price was lower while Baro was here than in the week after (0–1). */
  dipShare: number | null;
  confidence: Confidence;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const dayStart = (iso: string) => Date.parse(iso.slice(0, 10) + "T00:00:00Z");

/** Per past visit: median daily price while Baro was here and in each later window. `arrival` is the CURRENT visit's arrival time. */
export function cycleStats(history: DayPrice[], arrival: string, cycles = 6): CycleStat[] {
  const byDay = new Map(history.map((h) => [dayStart(h.day), h.price]));
  const a0 = dayStart(arrival);
  const window = (start: number, [lo, hi]: [number, number]) => {
    const vals: number[] = [];
    for (let d = lo; d <= hi; d++) { const v = byDay.get(start + d * DAY); if (v != null) vals.push(v); }
    return median(vals);
  };
  return Array.from({ length: cycles }, (_, i) => {
    const start = a0 - CYCLE_DAYS * (i + 1) * DAY;
    return { arrival: new Date(start).toISOString().slice(0, 10), during: window(start, [0, 2]), short: window(start, SHORT_WINDOW), long: window(start, LONG_WINDOW) };
  });
}

/** Typical price movement after Baro leaves, from the history. */
export function analyseBaro(history: DayPrice[], arrival: string, cycles = 6): BaroAnalysis {
  const stats = cycleStats(history, arrival, cycles).filter((c) => c.during != null && c.during > 0 && (c.short != null || c.long != null));
  const clamp = (r: number) => Math.min(RATIO_CLAMP[1], Math.max(RATIO_CLAMP[0], r));
  const ratio = (pick: (c: CycleStat) => number | null) => {
    const rs = stats.flatMap((c) => { const v = pick(c); return v != null ? [clamp(v / (c.during as number))] : []; });
    return rs.length >= 2 ? Math.round((median(rs) as number) * 1000) / 1000 : null;
  };
  const dips = stats.filter((c) => c.short != null);
  const dipShare = dips.length ? dips.filter((c) => (c.during as number) <= (c.short as number) * 0.98).length / dips.length : null;
  const n = stats.length;
  const confidence: Confidence = n >= 4 && dipShare != null && dipShare >= 0.7 ? "strong" : n >= 3 ? "some" : n >= 1 ? "weak" : "none";
  return { cycles: n, ratioShort: ratio((c) => c.short), ratioLong: ratio((c) => c.long), dipShare: dipShare == null ? null : Math.round(dipShare * 100) / 100, confidence };
}

export type Horizon = "short" | "long";

/** What a unit bought now (at `priceNow`) might sell for at the horizon, or null without a price or history. */
export function projectPrice(priceNow: number | null, a: Pick<BaroAnalysis, "ratioShort" | "ratioLong">, horizon: Horizon): number | null {
  const r = horizon === "short" ? a.ratioShort : a.ratioLong;
  return priceNow == null || r == null ? null : Math.round(priceNow * r * 10) / 10;
}

/** Platinum you'd get per 100 ducats spent (higher = a better use of ducats). */
export const platPer100Ducats = (sell: number | null, ducats: number | null) => (sell == null || !ducats ? null : Math.round((sell / ducats) * 1000) / 10);

/** A plain-English tip for the item, from the numbers. */
export function baroTip(priceNow: number | null, a: BaroAnalysis): string {
  if (priceNow == null) return "Nobody is selling this on Warframe Market right now, so there’s no price to work from.";
  if (a.ratioShort == null && a.ratioLong == null) return "Not enough price history to say what Baro does to this item.";
  const pct = (r: number) => Math.round((r - 1) * 100);
  const sh = a.ratioShort, lg = a.ratioLong;
  const parts: string[] = [];
  if (sh != null) parts.push(pct(sh) >= 5 ? `Buy and hold about a week: it has typically recovered ${pct(sh)}% within a week of Baro leaving (≈ ${Math.round(priceNow * sh)}p).` : pct(sh) <= -5 ? `It has typically kept falling (${pct(sh)}% a week later), so it’s better sold straight away or skipped.` : "Within a week it usually stays about the same, so there’s no quick flip.");
  if (lg != null) parts.push(pct(lg) >= 5 ? `Held 2–4 weeks it has typically gained ${pct(lg)}% (≈ ${Math.round(priceNow * lg)}p).` : pct(lg) <= -5 ? `Held 2–4 weeks it has typically lost ${Math.abs(pct(lg))}%.` : "Held 2–4 weeks it usually ends up about where it started.");
  if (a.confidence === "weak" || a.confidence === "none") parts.push("Based on very little history — treat as a guess.");
  else if (a.dipShare != null && a.dipShare < 0.5) parts.push("It doesn’t reliably dip while Baro is here, so this pattern may not be Baro’s doing.");
  return parts.join(" ");
}
