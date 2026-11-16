import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SalesDay } from "@/lib/history-sales";
import { findDeals, reboundEvents, type DipEvent, type Level } from "@/lib/primes/deals";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { itemWeekdays, marketWeekdays, type ItemWeekday } from "./weekday";

export const INSIGHTS_TTL_MS = 20 * 3_600_000;

const num = (v: unknown) => (v == null ? null : Number(v));

/** Pulls the 90-day sold history of the given items, a few at a time. */
async function loadSales(sb: SupabaseClient, slugs: string[]): Promise<Map<string, SalesDay[]>> {
  const out = new Map<string, SalesDay[]>();
  for (let i = 0; i < slugs.length; i += 15) {
    const { data } = await sb.from("sales_history").select("slug,day,avg_price,min_price,max_price,volume").in("slug", slugs.slice(i, i + 15)).order("day").limit(5000);
    for (const s of (data ?? []) as Record<string, unknown>[]) {
      const l = out.get(s.slug as string) ?? [];
      l.push({ day: s.day as string, avg: Number(s.avg_price), min: num(s.min_price), max: num(s.max_price), volume: Number(s.volume ?? 0) });
      out.set(s.slug as string, l);
    }
  }
  return out;
}

export async function insightsDue(sb: SupabaseClient, now = Date.now()): Promise<boolean> {
  const { data } = await sb.from("accuracy_stats").select("computed_at").eq("key", "dip_backtest").maybeSingle();
  return !data || now - Date.parse(data.computed_at as string) > INSIGHTS_TTL_MS;
}

/** The daily job: the weekday pattern across the market, the buy-low back-test, and a record of today's deals to score later. `sb` is service-role. */
export async function computeInsights(sb: SupabaseClient, now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10);
  const { data: lv } = await sb.rpc("price_levels");
  const levels: Level[] = ((lv ?? []) as Record<string, unknown>[]).map((r) => ({ slug: r.slug as string, typical: num(r.typical), recent: num(r.recent), prev: num(r.prev), per_day: num(r.per_day), days: Number(r.days ?? 0) }));
  const eligible = levels.filter((l) => (l.typical ?? 0) >= 10 && (l.per_day ?? 0) >= 3 && l.days >= 25).map((l) => l.slug).slice(0, 450);
  const sales = await loadSales(sb, eligible);

  const perItem: ItemWeekday[][] = [];
  const events: DipEvent[] = [];
  let withDips = 0;
  for (const slug of eligible) {
    const s = sales.get(slug) ?? [];
    if (s.length < 40) continue;
    perItem.push(itemWeekdays(s, today));
    const e = reboundEvents(s);
    if (e.length) withDips++;
    events.push(...e);
  }
  const bucket = (lo: number, hi: number) => { const x = events.filter((e) => e.depth >= lo && e.depth < hi); return { lo, hi, dips: x.length, recovered: x.filter((e) => e.recovered).length }; };
  await sb.from("accuracy_stats").upsert([
    { key: "seasonality", data: { items: perItem.length, days: marketWeekdays(perItem) }, computed_at: new Date(now).toISOString() },
    { key: "dip_backtest", data: { items: perItem.length, itemsWithDips: withDips, dips: events.length, recovered: events.filter((e) => e.recovered).length, buckets: [bucket(10, 15), bucket(15, 25), bucket(25, 1000)] }, computed_at: new Date(now).toISOString() },
  ], { onConflict: "key" });

  // today's flagged deals, kept so they can be scored two weeks on
  const { data: ip } = await sb.from("item_prices").select("slug,avg5,listings");
  const ask = new Map(((ip ?? []) as { slug: string; avg5: number | null; listings: number }[]).map((p) => [p.slug, p]));
  const { deals } = findDeals(levels, primeCatalogue.parts, (s) => { const p = ask.get(s); return p ? { avg5: p.avg5 == null ? null : Number(p.avg5), listings: p.listings } : undefined; });
  const typical = new Map(levels.map((l) => [l.slug, l.typical]));
  if (deals.length) await sb.from("prediction_log").upsert(deals.slice(0, 20).map((d) => ({ kind: "buy_low", slug: d.slug, name: d.name, made_on: today, ask: d.ask, normal: d.normal, typical: typical.get(d.slug) ?? d.typical })), { onConflict: "kind,slug,made_on", ignoreDuplicates: true });
  return { items: perItem.length, dips: events.length, deals: Math.min(20, deals.length) };
}
