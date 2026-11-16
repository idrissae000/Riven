import type { SalesDay } from "@/lib/history-sales";
import { projectPrice, type BaroAnalysis } from "@/lib/baro/analysis";

const DAY = 86_400_000;
const key = (t: number) => new Date(t).toISOString().slice(0, 10);
const vwap = (rows: SalesDay[]) => { const v = rows.reduce((s, r) => s + r.volume, 0); return v > 0 ? rows.reduce((s, r) => s + r.avg * r.volume, 0) / v : null; };
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };

export interface Prediction { slug: string; name: string; made_on: string; ask: number; typical: number }
export interface Scored { slug: string; name: string; madeOn: string; ask: number; later: number | null; returnPct: number | null; hit: boolean | null }

/** How a flagged deal turned out: what the item sold for 7 to 14 days after it was flagged, against the asking price at the time. A "hit" is a later sale price 5%+ above that ask. Deals less than 14 days old are still pending. */
export function scoreDeals(preds: Prediction[], sales: Map<string, SalesDay[]>, today: string) {
  const scored: Scored[] = [];
  let pending = 0;
  for (const p of preds) {
    const t = Date.parse(p.made_on + "T00:00:00Z");
    if (key(t + 14 * DAY) >= today) { pending++; continue; }
    const rows = (sales.get(p.slug) ?? []).filter((s) => s.day >= key(t + 7 * DAY) && s.day <= key(t + 14 * DAY));
    const later = vwap(rows);
    scored.push({ slug: p.slug, name: p.name, madeOn: p.made_on, ask: p.ask, later: later == null ? null : Math.round(later * 10) / 10, returnPct: later == null ? null : Math.round((later / p.ask - 1) * 1000) / 10, hit: later == null ? null : later >= p.ask * 1.05 });
  }
  const judged = scored.filter((s) => s.hit != null);
  return {
    scored, pending, judged: judged.length, hits: judged.filter((s) => s.hit).length,
    medianReturn: median(judged.map((s) => s.returnPct as number)),
  };
}

export interface BaroPast { name: string; slug: string; arrival: string; analysis: Pick<BaroAnalysis, "pre" | "ratioShort" | "ratioLong"> }
export interface BaroScored { name: string; arrival: string; estimate: number; actual: number | null; errPct: number | null }

/** Baro's "price 2-4 weeks after he leaves" estimates against what the item actually sold for on days 14-28 after he arrived (the median daily sold price). Visits less than 28 days old are pending. */
export function scoreBaro(past: BaroPast[], sales: Map<string, SalesDay[]>, today: string) {
  const scored: BaroScored[] = [];
  let pending = 0, noEstimate = 0;
  for (const b of past) {
    const est = projectPrice(b.analysis, "long");
    if (est == null) { noEstimate++; continue; }
    const t = Date.parse(b.arrival);
    if (key(t + 28 * DAY) >= today) { pending++; continue; }
    const rows = (sales.get(b.slug) ?? []).filter((s) => s.day >= key(t + 14 * DAY) && s.day <= key(t + 28 * DAY));
    const actual = median(rows.map((r) => r.avg));
    scored.push({ name: b.name, arrival: b.arrival, estimate: est, actual: actual == null ? null : Math.round(actual * 10) / 10, errPct: actual == null || actual === 0 ? null : Math.round(((est - actual) / actual) * 1000) / 10 });
  }
  const errs = scored.flatMap((s) => (s.errPct == null ? [] : [Math.abs(s.errPct)]));
  return { scored, pending, noEstimate, medianAbsErr: median(errs), within10: errs.filter((e) => e <= 10).length, judged: errs.length };
}
