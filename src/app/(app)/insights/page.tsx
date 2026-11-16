import { PageHeader } from "@/components/page-header";
import { listArcanes, listItemPrices } from "@/lib/data";
import type { SalesDay } from "@/lib/history-sales";
import { isReal, itemWeekdays, WEEKDAYS, type MarketWeekday } from "@/lib/insights/weekday";
import { scoreBaro, scoreDeals, type BaroPast, type Prediction } from "@/lib/insights/score";
import { askBaseline, type Level } from "@/lib/primes/deals";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Insights" };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const sg = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}%`;
const toSales = (rows: Record<string, unknown>[]) => { const m = new Map<string, SalesDay[]>(); for (const s of rows) { const l = m.get(s.slug as string) ?? []; l.push({ day: s.day as string, avg: Number(s.avg_price), min: s.min_price == null ? null : Number(s.min_price), max: s.max_price == null ? null : Number(s.max_price), volume: Number(s.volume ?? 0) }); m.set(s.slug as string, l); } return m; };
const ago = (iso: string) => { const h = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 3_600_000)); return h < 1 ? "just now" : h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`; };

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const { item } = await searchParams;
  const sb = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: stats }, arcanes, prices, { data: lv }, { data: preds }, { data: baroRows }] = await Promise.all([
    sb.from("accuracy_stats").select("key,data,computed_at"),
    listArcanes(), listItemPrices(), sb.rpc("price_levels"),
    sb.from("prediction_log").select("slug,name,made_on,ask,typical").eq("kind", "buy_low").order("made_on", { ascending: false }).limit(600),
    sb.from("baro_items").select("visit,name,wfm_slug,pre_price,ratio_short,ratio_long").not("wfm_slug", "is", null).not("pre_price", "is", null),
  ]);
  const stat = (k: string) => (stats ?? []).find((s) => s.key === k) as { data: Record<string, any>; computed_at: string } | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  const season = stat("seasonality"), back = stat("dip_backtest");

  // one item's weekday pattern, on request
  const options = [...primeCatalogue.parts.map((p) => ({ slug: p.slug, name: p.name })), ...arcanes.map((a) => ({ slug: a.slug, name: a.name }))];
  const picked = item ? options.find((o) => o.name.toLowerCase() === item.trim().toLowerCase()) : undefined;
  let itemDays: ReturnType<typeof itemWeekdays> | null = null;
  if (picked) {
    const { data } = await sb.from("sales_history").select("slug,day,avg_price,min_price,max_price,volume").eq("slug", picked.slug).order("day").limit(200);
    itemDays = itemWeekdays(toSales((data ?? []) as Record<string, unknown>[]).get(picked.slug) ?? [], today);
  }

  // live scorecards
  const predList = ((preds ?? []) as { slug: string; name: string; made_on: string; ask: number | string; typical: number | string }[]).map((p): Prediction => ({ slug: p.slug, name: p.name, made_on: p.made_on, ask: Number(p.ask), typical: Number(p.typical) }));
  const baroPast: BaroPast[] = ((baroRows ?? []) as Record<string, unknown>[]).map((r) => ({ name: r.name as string, slug: r.wfm_slug as string, arrival: r.visit as string, analysis: { pre: Number(r.pre_price), ratioShort: r.ratio_short == null ? null : Number(r.ratio_short), ratioLong: r.ratio_long == null ? null : Number(r.ratio_long) } }));
  const needSlugs = [...new Set([...predList.map((p) => p.slug), ...baroPast.map((b) => b.slug)])];
  let salesBy = new Map<string, SalesDay[]>();
  if (needSlugs.length) {
    const { data } = await sb.from("sales_history").select("slug,day,avg_price,min_price,max_price,volume").in("slug", needSlugs.slice(0, 150)).order("day").limit(5000);
    salesBy = toSales((data ?? []) as Record<string, unknown>[]);
  }
  const deals = scoreDeals(predList, salesBy, today), baro = scoreBaro(baroPast, salesBy, today);

  const levels: Level[] = ((lv ?? []) as Record<string, unknown>[]).map((r) => ({ slug: r.slug as string, typical: r.typical == null ? null : Number(r.typical), recent: null, prev: null, per_day: r.per_day == null ? null : Number(r.per_day), days: Number(r.days ?? 0) }));
  const askBy = new Map(prices.map((p) => [p.slug, p]));
  const baseline = askBaseline(levels, (s) => { const p = askBy.get(s); return p ? { avg5: p.avg5, listings: p.listings } : undefined; });

  const days = (season?.data.days ?? []) as MarketWeekday[];
  const real = days.flatMap((d) => [...(isReal(d.price, d.priceLo, d.priceHi, 0.3) ? [`${WEEKDAYS[d.dow]} prices run ${sg(d.price)} ${d.price > 0 ? "above" : "below"} the week’s average`] : []), ...(isReal(d.volume, d.volumeLo, d.volumeHi, 2) ? [`${WEEKDAYS[d.dow]} sees ${sg(d.volume)} ${d.volume > 0 ? "more" : "fewer"} sales than average`] : [])]);

  return (
    <div className="space-y-8">
      <PageHeader kicker="How sure are we" title="Insights" />

      <section className="space-y-3">
        <h2 className="kicker">Seasonality — do prices follow the day of the week?</h2>
        <div className="card space-y-3 text-sm">
          <p className="text-dim">For {season ? `${season.data.items} fast-selling items` : "fast-selling items"}, each day’s selling price and sales count compared with the average of the week centred on it, which removes trends. Averaged per weekday across items, with a 95% interval. A pattern only counts as real when that whole interval is on one side of zero and the effect isn’t trivial (0.3% for price, 2% for volume).{season ? ` Updated ${ago(season.computed_at)}.` : ""}</p>
          {!season ? <p className="text-dim">Computing for the first time — it runs once a day. Check back soon.</p> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead><tr className="text-left text-xs text-dim"><th className="py-1 font-normal">Day</th><th className="font-normal">Price vs week</th><th className="font-normal">Sales vs week</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {days.map((d) => {
                      const pr = isReal(d.price, d.priceLo, d.priceHi, 0.3), vo = isReal(d.volume, d.volumeLo, d.volumeHi, 2);
                      return (
                        <tr key={d.dow}>
                          <td className="py-1.5 text-ink">{WEEKDAYS[d.dow]}</td>
                          <td className={pr ? (d.price > 0 ? "text-ok" : "text-danger") : "text-dim"}>{sg(d.price)} <span className="text-xs">({sg(d.priceLo)} to {sg(d.priceHi)}){pr ? " · real" : ""}</span></td>
                          <td className={vo ? (d.volume > 0 ? "text-ok" : "text-danger") : "text-dim"}>{sg(d.volume)} <span className="text-xs">({sg(d.volumeLo)} to {sg(d.volumeHi)}){vo ? " · real" : ""}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-ink">{real.length ? `What the data supports: ${real.join("; ")}.` : "No weekday pattern is strong enough to rely on, so there’s no best day to buy or sell. Anything else would be noise."}</p>
            </>
          )}
        </div>

        <form method="get" className="card space-y-2">
          <label className="label" htmlFor="in-item">Check one item</label>
          <div className="flex flex-wrap gap-2">
            <input id="in-item" name="item" className="input min-w-0 flex-1" list="in-options" defaultValue={item ?? ""} placeholder="A Prime part, set or arcane…" autoComplete="off" />
            <datalist id="in-options">{options.map((o) => <option key={o.slug} value={o.name} />)}</datalist>
            <button className="btn-primary">Check</button>
          </div>
          {item && !picked && <p className="text-sm text-orange">Pick an item from the suggestions.</p>}
          {picked && itemDays && (
            <div className="space-y-1 pt-1 text-sm">
              <p className="text-dim">{picked.name}: with about 12 of each weekday in 90 days, a weekday is flagged only if it was on the same side of the average nearly every single week (sign test, p &lt; 0.01) and the gap is 1%+. Anything less is noise at this sample size.</p>
              <ul className="divide-y divide-line">
                {itemDays.map((d) => {
                  const pr = d.price != null && d.priceP < 0.01 && Math.abs(d.price) >= 1, vo = d.volume != null && d.volumeP < 0.01 && Math.abs(d.volume) >= 5;
                  return <li key={d.dow} className="flex justify-between gap-3 py-1"><span className="text-ink">{WEEKDAYS[d.dow]} <span className="text-xs text-dim">· {d.n} weeks</span></span><span className="text-xs text-dim">{pr ? <b className={d.price! > 0 ? "text-ok" : "text-danger"}>price {sg(d.price!)} (consistent)</b> : "no reliable price pattern"} · {vo ? <b className={d.volume! > 0 ? "text-ok" : "text-danger"}>sales {sg(d.volume!)} (consistent)</b> : "no reliable sales pattern"}</span></li>;
                })}
              </ul>
            </div>
          )}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="kicker">Accuracy — how have our calls held up?</h2>

        <div className="card space-y-2 text-sm">
          <p className="text-ink">Buy-low back-test</p>
          {!back ? <p className="text-dim">Computing for the first time — it runs once a day.</p> : (
            <>
              <p className="text-dim">Across {back.data.items} fast-selling items’ last 90 days: every time an item’s selling price fell 10%+ under its usual, did it get back to within 5% of usual inside two weeks? (Updated {ago(back.computed_at)}.)</p>
              <p className="text-ink">{back.data.dips > 0 ? <><b>{Math.round((back.data.recovered / back.data.dips) * 100)}%</b> recovered — {back.data.recovered} of {back.data.dips} dips, in {back.data.itemsWithDips} items.</> : "No dips to judge."}</p>
              <ul className="divide-y divide-line text-xs text-dim">
                {(back.data.buckets as { lo: number; hi: number; dips: number; recovered: number }[]).map((b) => (
                  <li key={b.lo} className="flex justify-between py-1"><span>{b.hi >= 1000 ? `${b.lo}%+ below usual` : `${b.lo}–${b.hi}% below usual`}</span><span>{b.dips > 0 ? `${Math.round((b.recovered / b.dips) * 100)}% recovered (${b.recovered} of ${b.dips})` : "no dips"}</span></li>
                ))}
              </ul>
              <p className="text-xs text-dim">A dip that recovers isn’t automatically a profit — you also have to find the buy and sell it. And 90 days is a short record. Read this as a base rate, not a promise.</p>
            </>
          )}
        </div>

        <div className="card space-y-2 text-sm">
          <p className="text-ink">Deals we’ve flagged (live record)</p>
          <p className="text-dim">Every day the site saves its “buy low” list. Two weeks later, each is checked: did it sell 5%+ above the asking price at the time, between 7 and 14 days on?</p>
          {deals.judged > 0 ? (
            <>
              <p className="text-ink"><b>{Math.round((deals.hits / deals.judged) * 100)}%</b> did — {deals.hits} of {deals.judged} scored. Median result {deals.medianReturn != null ? sg(Math.round(deals.medianReturn * 10) / 10) : "—"} versus the asking price then.</p>
              <ul className="divide-y divide-line text-xs text-dim">{deals.scored.filter((s) => s.later != null).slice(0, 8).map((s) => <li key={s.slug + s.madeOn} className="flex justify-between gap-2 py-1"><span>{s.name} · {s.madeOn}</span><span>asked {fmt(s.ask)}p → sold {fmt(s.later as number)}p ({sg(s.returnPct as number)}) {s.hit ? "✓" : "✗"}</span></li>)}</ul>
            </>
          ) : <p className="text-dim">Nothing is old enough to score yet. {deals.pending > 0 ? `${deals.pending} deals are waiting out their two weeks.` : "The record starts with the next daily run."} Results appear here as they mature.</p>}
        </div>

        <div className="card space-y-2 text-sm">
          <p className="text-ink">Baro’s “price 2–4 weeks after he leaves”</p>
          <p className="text-dim">Each estimate is checked against what the item actually sold for (median daily price) 14–28 days after he arrived.</p>
          {baro.judged > 0 ? (
            <>
              <p className="text-ink">Median miss <b>{baro.medianAbsErr != null ? `${Math.round(baro.medianAbsErr * 10) / 10}%` : "—"}</b>; {baro.within10} of {baro.judged} within 10%.</p>
              <ul className="divide-y divide-line text-xs text-dim">{baro.scored.filter((s) => s.actual != null).slice(0, 10).map((s) => <li key={s.name + s.arrival} className="flex justify-between gap-2 py-1"><span>{s.name}</span><span>estimated {fmt(s.estimate)}p · sold for {fmt(s.actual as number)}p ({sg(s.errPct as number)})</span></li>)}</ul>
            </>
          ) : <p className="text-dim">No visit is old enough yet{baro.pending > 0 ? ` — ${baro.pending} item estimates from his latest visit are waiting for the 28 days to pass` : ""}. Results appear here as visits age.</p>}
        </div>

        <div className="card space-y-1 text-sm">
          <p className="text-ink">Asking prices vs sold prices</p>
          <p className="text-dim">Across all tracked items, the cheapest-5 asking average sits at <b className="text-ink">{Math.round(baseline * 1000) / 10}%</b> of the 30-day median sale price. That gap is built into every “buy low” call so asks aren’t compared with sold prices directly.</p>
        </div>
      </section>
    </div>
  );
}
