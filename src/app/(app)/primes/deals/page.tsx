import Link from "next/link";
import { Plat } from "@/components/brand";
import { PageHeader } from "@/components/page-header";
import { PriceRefresher } from "@/components/price-refresher";
import { PrimesTabs } from "@/components/primes-tabs";
import { listItemPrices } from "@/lib/data";
import type { SalesDay } from "@/lib/history-sales";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { findDeals, reboundStats, type Level } from "@/lib/primes/deals";
import { itemsDue } from "@/lib/primes/due";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Buy low" };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default async function DealsPage() {
  const sb = await createClient();
  const [prices, { data }] = await Promise.all([listItemPrices(), sb.rpc("price_levels")]);
  const by = new Map(prices.map((p) => [p.slug, p]));
  const levels: Level[] = ((data ?? []) as Record<string, unknown>[]).map((r) => ({ slug: r.slug as string, typical: r.typical == null ? null : Number(r.typical), recent: r.recent == null ? null : Number(r.recent), prev: r.prev == null ? null : Number(r.prev), per_day: r.per_day == null ? null : Number(r.per_day), days: Number(r.days ?? 0) }));
  const { deals, baseline } = findDeals(levels, primeCatalogue.parts, (s) => { const p = by.get(s); return p ? { avg5: p.avg5, listings: p.listings } : undefined; });
  const top = deals.slice(0, 20);

  // how often each one's own past dips came back (full 90 days, only for the ones shown)
  const history = new Map<string, SalesDay[]>();
  if (top.length) {
    const { data: rows } = await sb.from("sales_history").select("slug,day,avg_price,min_price,max_price,volume").in("slug", top.map((d) => d.slug)).order("day").limit(5000);
    for (const s of (rows ?? []) as Record<string, unknown>[]) { const l = history.get(s.slug as string) ?? []; l.push({ day: s.day as string, avg: Number(s.avg_price), min: s.min_price == null ? null : Number(s.min_price), max: s.max_price == null ? null : Number(s.max_price), volume: Number(s.volume ?? 0) }); history.set(s.slug as string, l); }
  }

  return (
    <div className="space-y-5">
      <PageHeader kicker="Prime market" title="Buy low" />
      <PrimesTabs active="deals" />
      <PriceRefresher due={itemsDue(primeCatalogue.parts.map((p) => p.slug), prices)} endpoint="/api/primes/prices/refresh" />
      <section className="card space-y-1 text-sm text-dim">
        <p>Prime parts and sets that sell at least 3 a day, with 3+ online sellers, whose asking price is 10%+ under where the item normally trades.</p>
        <p>“Normally” is the item’s own 30-day record: the median selling price, adjusted for how asking prices usually sit against selling prices across all items (right now asks run about {Math.round((baseline - 1) * 1000) / 10}% {baseline >= 1 ? "above" : "below"} the median sale). So a part only shows up when it’s cheap by its own standard, not just cheaper than its sold price.</p>
        <p>“Bounced back” counts, in the item’s last 90 days, the times its selling price fell 10%+ under its usual and then got back to within 5% inside two weeks. A part marked <b className="text-orange">still sliding</b> is being sold for less than it was a few days ago, so wait for it to settle.</p>
      </section>

      {top.length === 0 ? (
        <p className="card text-sm text-dim">Nothing is unusually cheap right now. The market is priced in line with its history, so there’s no discount to chase. Check back after a price drop.</p>
      ) : (
        <ul className="space-y-2">
          {top.map((d) => {
            const r = reboundStats(history.get(d.slug) ?? []);
            return (
              <li key={d.slug} className="card flex flex-wrap items-center justify-between gap-x-6 gap-y-2 !p-3.5">
                <div className="min-w-0">
                  <Link href={`/primes/${d.slug}`} className="truncate text-sm text-ink hover:text-gold">{d.name}</Link>
                  <p className="text-xs text-dim">sells ~{fmt(d.perDay)}/day · {d.listings} online sellers{d.falling ? <> · <span className="text-orange">still sliding</span></> : null}</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-dim">
                  <span>buy at <b className="inline-flex items-center gap-0.5 text-plat">{fmt(d.ask)}<Plat size={11} /></b></span>
                  <span>normally <b className="inline-flex items-center gap-0.5 text-ink">{fmt(d.normal)}<Plat size={11} /></b></span>
                  <span className="text-ok">{d.discountPct}% under · +{fmt(d.gain)}p each</span>
                  <span>{r.dips >= 3 ? `bounced back ${r.recovered} of ${r.dips} times` : r.dips > 0 ? `only ${r.dips} past dip${r.dips === 1 ? "" : "s"} to judge by` : "no past dips to judge by"}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
