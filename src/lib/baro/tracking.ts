import type { SalesDay } from "@/lib/history-sales";

const DAY = 86_400_000;
const dayMs = (iso: string) => Date.parse(iso.slice(0, 10) + "T00:00:00Z");
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface Tracking {
  /** The week before he arrived: the item's usual price (median daily price paid). */
  usual: number | null;
  /** While Baro was here (his 3 days): median price paid, and units sold per day. */
  during: number | null;
  duringVolume: number | null;
  /** Since he left: the latest day's price, the median of the last 3 days, the highest day, and units sold per day. */
  latest: number | null;
  recent: number | null;
  peak: { price: number; day: string } | null;
  sinceVolume: number | null;
  /** Days since he left (days of sales we have after his visit). */
  days: number;
  /** recent vs during, and recent vs usual (percent). */
  vsDuring: number | null;
  vsUsual: number | null;
  /** Units/day since he left vs while he was here (1 = same). */
  speed: number | null;
}

/**
 * How an item has behaved since Baro's visit (arrival ISO → leaving 2 days later), from its daily sales: price versus while he was
 * here and versus its usual price, and how fast it's been selling. Days without sales are skipped, not counted as zero price.
 */
export function trackSinceBaro(sales: SalesDay[], arrival: string): Tracking {
  const a0 = dayMs(arrival);
  const inRange = (lo: number, hi: number) => sales.filter((s) => { const d = (dayMs(s.day) - a0) / DAY; return d >= lo && d <= hi; });
  const pre = inRange(-7, -1), during = inRange(0, 2), since = inRange(3, 10_000).sort((a, b) => a.day.localeCompare(b.day));

  const usual = median(pre.map((s) => s.avg));
  const dur = median(during.map((s) => s.avg));
  const recent = median(since.slice(-3).map((s) => s.avg));
  const peakRow = since.reduce<SalesDay | null>((p, s) => (!p || s.avg > p.avg ? s : p), null);
  const avgVol = (rows: SalesDay[], days: number) => (rows.length ? rows.reduce((s, x) => s + x.volume, 0) / days : null);
  const duringVolume = avgVol(during, Math.max(1, during.length));
  const sinceDays = since.length ? Math.round((dayMs(since[since.length - 1].day) - (a0 + 2 * DAY)) / DAY) : 0;
  const sinceVolume = avgVol(since, Math.max(1, since.length));
  return {
    usual: usual == null ? null : r1(usual), during: dur == null ? null : r1(dur), duringVolume: duringVolume == null ? null : r1(duringVolume),
    latest: since.length ? since[since.length - 1].avg : null, recent: recent == null ? null : r1(recent),
    peak: peakRow ? { price: peakRow.avg, day: peakRow.day } : null, sinceVolume: sinceVolume == null ? null : r1(sinceVolume), days: sinceDays,
    vsDuring: recent != null && dur ? Math.round((recent / dur - 1) * 100) : null,
    vsUsual: recent != null && usual ? Math.round((recent / usual - 1) * 100) : null,
    speed: sinceVolume != null && duringVolume ? Math.round((sinceVolume / duringVolume) * 100) / 100 : null,
  };
}

/** A short read on where the item is now, from the tracking numbers. */
export function trackingNote(t: Tracking, liveNow: number | null): string {
  if (t.during == null && t.recent == null) return "Not enough sales yet to track this one.";
  if (t.recent == null) return "No sales since he left yet.";
  const parts: string[] = [];
  if (t.vsDuring != null) parts.push(t.vsDuring >= 5 ? `Up ${t.vsDuring}% on what it sold for while Baro was here.` : t.vsDuring <= -5 ? `Down ${Math.abs(t.vsDuring)}% from while Baro was here.` : "About the same as while Baro was here.");
  if (t.vsUsual != null && t.usual != null) parts.push(t.vsUsual >= -5 ? `Back to its usual price (≈ ${Math.round(t.usual)}p).` : `Still ${Math.abs(t.vsUsual)}% below its usual ≈ ${Math.round(t.usual)}p.`);
  if (t.speed != null) parts.push(t.speed >= 1.2 ? "Selling faster than while he was here." : t.speed <= 0.8 ? "Selling slower than while he was here." : "Selling at a similar pace.");
  if (liveNow != null && t.recent > 0 && liveNow >= t.recent * 1.1) parts.push(`Asking prices (${Math.round(liveNow)}p) are above recent sales.`);
  return parts.join(" ");
}
