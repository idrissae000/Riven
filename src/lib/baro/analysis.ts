/**
 * What Baro Ki'Teer's visits have historically done to an item's price, from its daily closed-trade history — records only.
 *
 * Baro arrives every 14 days and stays ~2 days. The anchor is the item's USUAL price: the median daily price paid over the 7 days
 * before he arrived. For each of the last ~6 visits we look at three windows after he arrived (days 0–2 "while here", 3–8 "short",
 * 14–28 "long") and record whether the price was back to at least 95% of that visit's own pre-arrival level.
 *
 * Nothing here projects ABOVE the usual price. Past ratios above 1 are mostly the market trending up over the 90 days (which would
 * have happened without Baro), so the estimate is capped at the usual price, and it is only given when at least MIN_VISITS visits
 * have records for that window. The hit counts ("back to usual in 5 of 6 visits") are shown next to it so the evidence is visible.
 * The history cannot tell whether Baro actually sold the item on those earlier visits.
 */
export interface DayPrice { day: string; price: number }

const DAY = 86_400_000;
export const CYCLE_DAYS = 14;
export const PRE_WINDOW: [number, number] = [-7, -1];
export const SHORT_WINDOW: [number, number] = [3, 8];
export const LONG_WINDOW: [number, number] = [14, 28];
/** A window counts as "back to usual" when its price is at least this share of the visit's pre-arrival price. */
export const BACK_TO_USUAL = 0.95;
/** The fewest visits with records for a window before an estimate is given for it. */
export const MIN_VISITS = 4;

export interface CycleStat { arrival: string; pre: number | null; during: number | null; short: number | null; long: number | null }
export type Confidence = "strong" | "some" | "weak" | "none";
export interface BaroAnalysis {
  /** The item's usual price just before Baro arrived this time (median daily sold price over the previous 7 days); null without sales then. */
  pre: number | null;
  /** Past visits that had a pre-arrival price and at least one later window. */
  cycles: number;
  /** Typical (median) price in the short / long window relative to the pre-arrival level; null with fewer than MIN_VISITS visits of records. Used only to pull the estimate DOWN (never above usual). */
  ratioShort: number | null;
  ratioLong: number | null;
  /** In how many visits the window was back to ≥ 95% of the pre-arrival price (hits), out of how many had records (n). */
  shortHits: number; shortN: number;
  longHits: number; longN: number;
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

/** The usual price before this visit, and the record of how past visits' prices came back. */
export function analyseBaro(history: DayPrice[], arrival: string, cycles = 6): BaroAnalysis {
  const byDay = new Map(history.map((h) => [dayStart(h.day), h.price]));
  const pre = windowMedian(byDay, dayStart(arrival), PRE_WINDOW);
  const stats = cycleStats(history, arrival, cycles).filter((c) => c.pre != null && c.pre > 0 && (c.short != null || c.long != null));
  const tally = (pick: (c: CycleStat) => number | null) => {
    const vals = stats.flatMap((c) => { const v = pick(c); return v != null ? [{ ratio: v / (c.pre as number) }] : []; });
    const hits = vals.filter((x) => x.ratio >= BACK_TO_USUAL).length;
    const ratio = vals.length >= MIN_VISITS ? Math.round((median(vals.map((x) => x.ratio)) as number) * 1000) / 1000 : null;
    return { n: vals.length, hits, ratio };
  };
  const sh = tally((c) => c.short), lg = tally((c) => c.long);
  const dips = stats.filter((c) => c.during != null);
  const dipShare = dips.length ? dips.filter((c) => (c.during as number) <= (c.pre as number) * 0.98).length / dips.length : null;
  const n = stats.length;
  const confidence: Confidence = n >= 4 && dipShare != null && dipShare >= 0.7 ? "strong" : n >= 3 ? "some" : n >= 1 ? "weak" : "none";
  return { pre: pre == null ? null : Math.round(pre * 10) / 10, cycles: n, ratioShort: sh.ratio, ratioLong: lg.ratio, shortHits: sh.hits, shortN: sh.n, longHits: lg.hits, longN: lg.n, dipShare: dipShare == null ? null : Math.round(dipShare * 100) / 100, confidence };
}

export type Horizon = "short" | "long";

/**
 * The most a unit bought now can be expected to sell for at the horizon, from the records: the usual (pre-arrival) price, pulled down if
 * past visits' prices typically came back lower — and never above it. Null without enough visits of records for that window.
 */
export function projectPrice(a: Pick<BaroAnalysis, "pre" | "ratioShort" | "ratioLong">, horizon: Horizon): number | null {
  const r = horizon === "short" ? a.ratioShort : a.ratioLong;
  return a.pre == null || r == null ? null : Math.round(a.pre * Math.min(1, r) * 10) / 10;
}

/** How many past visits had the price back to ≥ 95% of usual in the window (hits of n). */
export const evidence = (a: Pick<BaroAnalysis, "shortHits" | "shortN" | "longHits" | "longN">, horizon: Horizon) => (horizon === "short" ? { hits: a.shortHits, n: a.shortN } : { hits: a.longHits, n: a.longN });

/** Enough of the records agree: at least MIN_VISITS visits and at least 60% of them back to usual. */
export const backed = (a: Pick<BaroAnalysis, "shortHits" | "shortN" | "longHits" | "longN">, horizon: Horizon) => { const e = evidence(a, horizon); return e.n >= MIN_VISITS && e.hits / e.n >= 0.6; };

/** Platinum you'd get per 100 ducats spent (higher = a better use of ducats). */
export const platPer100Ducats = (sell: number | null, ducats: number | null) => (sell == null || !ducats ? null : Math.round((sell / ducats) * 1000) / 10);

/** A plain-English tip for the item, from the records only. `priceNow` is the live asking price. */
export function baroTip(priceNow: number | null, a: BaroAnalysis): string {
  if (priceNow == null) return "Nobody is selling this on Warframe Market right now, so there’s no price to work from.";
  if (a.pre == null) return "Not enough recent sales to know its usual price.";
  const parts: string[] = [];
  const below = Math.round((1 - priceNow / a.pre) * 100);
  parts.push(below >= 5 ? `It sold for about ${Math.round(a.pre)}p a day in the week before Baro arrived; the cheapest sellers are asking ${Math.round(priceNow)}p now (${below}% lower).` : `It sold for about ${Math.round(a.pre)}p a day in the week before Baro arrived, and the cheapest asks (${Math.round(priceNow)}p) aren’t far from that.`);
  const rec = (label: string, e: { hits: number; n: number }) => (e.n >= MIN_VISITS ? `${label} in ${e.hits} of ${e.n} past visits` : null);
  const s = rec("a week after", { hits: a.shortHits, n: a.shortN }), l = rec("2–4 weeks after", { hits: a.longHits, n: a.longN });
  if (s || l) parts.push(`Completed trades were at least 95% of that level ${[s, l].filter(Boolean).join(" and ")} Baro arrived.`);
  else parts.push("There aren’t enough past visits with sales to say how it recovers.");
  if (a.confidence === "weak" || a.confidence === "none") parts.push("Very little history — treat as a guess.");
  return parts.join(" ");
}
