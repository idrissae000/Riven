/**
 * What Baro Ki'Teer's visits have historically done to an item's price, from its daily closed-trade history.
 *
 * Baro arrives every 14 days and stays ~2 days; while he sells an item its price dips, then recovers. The anchor is the item's
 * USUAL price before he arrives (median daily price over the 7 days before arrival), not today's live price — today's asking
 * price is dropped the moment he lands, so measuring from it would hide the rebound. For each of the last ~6 visits we compare
 * that visit's pre-arrival level with:
 *   during = days 0–2 after arrival (Baro is here)
 *   short  = days 3–8  (the week after he leaves)
 *   long   = days 14–28 (two to four weeks out, past the next visit — the median shrugs off the few days of the next dip)
 * The typical ratio to the pre-arrival level (median over visits), applied to THIS visit's pre-arrival level, is the projected sale price.
 * It cannot know whether Baro actually sold the item on earlier visits, so it also reports how consistently the price dipped.
 */
export interface DayPrice { day: string; price: number }

const DAY = 86_400_000;
export const CYCLE_DAYS = 14;
export const PRE_WINDOW: [number, number] = [-7, -1];
export const SHORT_WINDOW: [number, number] = [3, 8];
export const LONG_WINDOW: [number, number] = [14, 28];
const RATIO_CLAMP: [number, number] = [0.5, 2.5];

export interface CycleStat { arrival: string; pre: number | null; during: number | null; short: number | null; long: number | null }
export type Confidence = "strong" | "some" | "weak" | "none";
export interface BaroAnalysis {
  /** The item's usual price just before Baro arrived this time (median daily sold price over the previous 7 days); null without sales then. */
  pre: number | null;
  /** Past visits that had prices before Baro arrived and in at least one later window. */
  cycles: number;
  /** Typical (median) price in the short / long window relative to the pre-arrival level, e.g. 0.97 or 1.05. */
  ratioShort: number | null;
  ratioLong: number | null;
  /** Share of visits where the price while Baro was here was lower than just before he arrived (0–1). */
  dipShare: number | null;
  confidence: Confidence;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const dayStart = (iso: string) => Date.parse(iso.slice(0, 10) + "T00:00:00Z");

function windowMedian(byDay: Map<number, number>, start: number, [lo, hi]: [number, number]): number | null {
  const vals: number[] = [];
  for (let d = lo; d <= hi; d++) { const v = byDay.get(start + d * DAY); if (v != null) vals.push(v); }
  return vals.length >= (hi - lo >= 6 ? 2 : 1) ? median(vals) : null; // a week-long window needs at least 2 days of sales
}

/** Per past visit: the median daily price before Baro arrived, while he was here, and in each later window. `arrival` is the CURRENT visit's arrival time. */
export function cycleStats(history: DayPrice[], arrival: string, cycles = 6): CycleStat[] {
  const byDay = new Map(history.map((h) => [dayStart(h.day), h.price]));
  const a0 = dayStart(arrival);
  return Array.from({ length: cycles }, (_, i) => {
    const start = a0 - CYCLE_DAYS * (i + 1) * DAY;
    return {
      arrival: new Date(start).toISOString().slice(0, 10),
      pre: windowMedian(byDay, start, PRE_WINDOW), during: windowMedian(byDay, start, [0, 2]),
      short: windowMedian(byDay, start, SHORT_WINDOW), long: windowMedian(byDay, start, LONG_WINDOW),
    };
  });
}

/** The usual price before this visit, and the typical movement after Baro leaves relative to it. */
export function analyseBaro(history: DayPrice[], arrival: string, cycles = 6): BaroAnalysis {
  const byDay = new Map(history.map((h) => [dayStart(h.day), h.price]));
  const pre = windowMedian(byDay, dayStart(arrival), PRE_WINDOW);
  const stats = cycleStats(history, arrival, cycles).filter((c) => c.pre != null && c.pre > 0 && (c.short != null || c.long != null));
  const clamp = (r: number) => Math.min(RATIO_CLAMP[1], Math.max(RATIO_CLAMP[0], r));
  const ratio = (pick: (c: CycleStat) => number | null) => {
    const rs = stats.flatMap((c) => { const v = pick(c); return v != null ? [clamp(v / (c.pre as number))] : []; });
    return rs.length >= 2 ? Math.round((median(rs) as number) * 1000) / 1000 : null;
  };
  const dips = stats.filter((c) => c.during != null);
  const dipShare = dips.length ? dips.filter((c) => (c.during as number) <= (c.pre as number) * 0.98).length / dips.length : null;
  const n = stats.length;
  const confidence: Confidence = n >= 4 && dipShare != null && dipShare >= 0.7 ? "strong" : n >= 3 ? "some" : n >= 1 ? "weak" : "none";
  return { pre: pre == null ? null : Math.round(pre * 10) / 10, cycles: n, ratioShort: ratio((c) => c.short), ratioLong: ratio((c) => c.long), dipShare: dipShare == null ? null : Math.round(dipShare * 100) / 100, confidence };
}

export type Horizon = "short" | "long";

/** What a unit bought now might sell for at the horizon: this visit's usual (pre-arrival) price × the typical recovery. Null without either. */
export function projectPrice(a: Pick<BaroAnalysis, "pre" | "ratioShort" | "ratioLong">, horizon: Horizon): number | null {
  const r = horizon === "short" ? a.ratioShort : a.ratioLong;
  return a.pre == null || r == null ? null : Math.round(a.pre * r * 10) / 10;
}

/** Platinum you'd get per 100 ducats spent (higher = a better use of ducats). */
export const platPer100Ducats = (sell: number | null, ducats: number | null) => (sell == null || !ducats ? null : Math.round((sell / ducats) * 1000) / 10);

/** A plain-English tip for the item, from the numbers. `priceNow` is the live asking price. */
export function baroTip(priceNow: number | null, a: BaroAnalysis): string {
  if (priceNow == null) return "Nobody is selling this on Warframe Market right now, so there’s no price to work from.";
  if (a.pre == null) return "Not enough recent sales to know its usual price.";
  const parts: string[] = [];
  const below = Math.round((1 - priceNow / a.pre) * 100);
  parts.push(below >= 5 ? `It usually sells for about ${Math.round(a.pre)}p when Baro isn’t here; it’s ${Math.round(priceNow)}p now (${below}% below).` : `It usually sells for about ${Math.round(a.pre)}p, and it isn’t discounted much right now (${Math.round(priceNow)}p).`);
  const sh = projectPrice(a, "short"), lg = projectPrice(a, "long");
  if (below >= 5 && sh != null && sh > priceNow * 1.05) parts.push(`Buy and hold about a week: after past visits it has been back to ≈ ${Math.round(sh)}p within a week of Baro leaving.`);
  else if (sh != null && sh < priceNow * 0.95) parts.push("After past visits it has kept sliding, so sell it straight away or skip it.");
  if (lg != null && Math.abs(lg - (sh ?? lg)) >= 2) parts.push(`Held 2–4 weeks it has typically been ≈ ${Math.round(lg)}p.`);
  if (a.confidence === "weak" || a.confidence === "none") parts.push("Based on very little history — treat as a guess.");
  else if (a.dipShare != null && a.dipShare < 0.5) parts.push("Its price doesn’t reliably dip while Baro is here, so this pattern may not be Baro’s doing.");
  return parts.join(" ");
}
