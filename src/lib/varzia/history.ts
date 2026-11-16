import type { SalesDay } from "@/lib/history-sales";
import type { Varzia } from "@/lib/worldstate";
import { setNameFor } from "@/lib/varzia/map";

export interface VarziaRowDb { visit: string; ends: string | null; name: string; regal: number | null; aya: number | null; slug: string | null; set_name: string | null }

/** The rows to keep for the rotation that's running: every item, with its Prime set's market slug when we can map it. */
export function varziaRows(v: Varzia, sets: Map<string, { slug: string; name: string }>): VarziaRowDb[] {
  return v.items.map((i) => {
    const want = setNameFor(i.item);
    const set = want ? sets.get(want.toLowerCase()) : undefined;
    return { visit: v.activation, ends: v.expiry, name: i.item, regal: i.regal, aya: i.aya, slug: set?.slug ?? null, set_name: set?.name ?? null };
  });
}

const DAY = 86_400_000;
const key = (t: number) => new Date(t).toISOString().slice(0, 10);
const wavg = (rows: SalesDay[]) => { const v = rows.reduce((s, r) => s + r.volume, 0); return v > 0 ? Math.round((rows.reduce((s, r) => s + r.avg * r.volume, 0) / v) * 10) / 10 : null; };

export interface Outcome { atEnd: number | null; now: number | null; changePct: number | null; daysSince: number; unitsPerDay: number | null }

/** How a set's sold price moved after Varzia's rotation ended: the 3 days up to the end against the last 3 complete days. */
export function rotationOutcome(sales: SalesDay[], endsIso: string, now: number): Outcome {
  const end = Date.parse(endsIso), endDay = key(end), from = key(end - 3 * DAY), today = key(now);
  const atEnd = wavg(sales.filter((s) => s.day > from && s.day <= endDay));
  const recent = sales.filter((s) => s.day >= key(now - 3 * DAY) && s.day < today);
  const nowP = wavg(recent);
  const changePct = atEnd != null && nowP != null && atEnd > 0 ? Math.round(((nowP - atEnd) / atEnd) * 1000) / 10 : null;
  const after = sales.filter((s) => s.day > endDay && s.day < today);
  return { atEnd, now: nowP, changePct, daysSince: Math.max(0, Math.floor((now - end) / DAY)), unitsPerDay: after.length ? Math.round((after.reduce((s, r) => s + r.volume, 0) / after.length) * 10) / 10 : null };
}
