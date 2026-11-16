import Link from "next/link";
import { Plat } from "@/components/brand";
import { CostCell } from "@/components/cost-cell";
import { Change, LiquidityBadge, SplitBar, Tile, ValueLine } from "@/components/portfolio";
import { PageHeader } from "@/components/page-header";
import { Watchlist, type WatchOption, type WatchRow } from "@/components/watchlist";
import { currentUserId, listArcanePrices, listArcanes, listItemPrices } from "@/lib/data";
import { priceView } from "@/lib/arcanes/price-view";
import type { SalesDay } from "@/lib/history-sales";
import { type OwnedItem } from "@/lib/inventory/value";
import { askBaseline, type Level } from "@/lib/primes/deals";
import { planSets } from "@/lib/primes/set-plan";
import { SIGNAL_LABEL, signalFor, type Signal } from "@/lib/portfolio/signals";
import { allocation, insights, marketSpeed, priceChange7d, profit, vsMarket, type Holding, type HoldingRow, type Sale } from "@/lib/portfolio/metrics";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My portfolio" };

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 1 }));
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`;

export default async function PortfolioPage() {
  const uid = await currentUserId();
  if (!uid) {
    return (
      <div className="space-y-5">
        <PageHeader kicker="Your money" title="My portfolio" />
        <div className="card space-y-3 text-sm text-dim">
          <p>What everything you own is worth, how it’s moving, where your platinum is tied up, what you’ve earned, and a watchlist — all in one place. It’s saved to your Warframe Economist account.</p>
          <Link href="/login?next=/portfolio" className="btn-primary">Sign in</Link>
        </div>
      </div>
    );
  }

  const now = new Date().getTime();
  const sb = await createClient();
  const [{ data: inv }, { data: rivenRows }, { data: saleRows }, { data: watchRows }, { data: snapRows }, itemPrices, arcanes, arcanePrices, { data: lv }] = await Promise.all([
    sb.from("inventory_items").select("id,kind,slug,rank,qty,cost_each"),
    sb.from("rivens").select("id,est_median"),
    sb.from("sales_log").select("item_name,qty,price_each,cost_each,sold_at,status").neq("status", "dismissed").order("sold_at", { ascending: false }).limit(2000),
    sb.from("watchlist").select("slug,kind,name").order("added_at", { ascending: false }),
    sb.from("portfolio_snapshots").select("day,total").order("day", { ascending: false }).limit(90),
    listItemPrices(), listArcanes(), listArcanePrices(),
    sb.rpc("price_levels"),
  ]);

  const owned = (inv ?? []) as (OwnedItem & { cost_each: number | null })[];
  const partBy = new Map(primeCatalogue.parts.map((p) => [p.slug, p]));
  const itemPrice = new Map(itemPrices.map((p) => [p.slug, p]));
  const arcaneBy = new Map(arcanes.map((a) => [a.slug, a]));
  const arcanePrice = new Map(arcanePrices.map((p) => [p.slug, p]));
  const watch = ((watchRows ?? []) as { slug: string; kind: "prime" | "arcane"; name: string }[]);

  // sold-price history (21 days) for everything held or watched
  const slugs = [...new Set([...owned.map((o) => o.slug), ...watch.map((w) => w.slug)])];
  const history = new Map<string, SalesDay[]>();
  if (slugs.length) {
    const since = new Date(now - 21 * 86_400_000).toISOString().slice(0, 10);
    const { data } = await sb.from("sales_history").select("slug,day,avg_price,min_price,max_price,volume").in("slug", slugs).gte("day", since).order("day").limit(5000);
    for (const s of (data ?? []) as Record<string, unknown>[]) {
      const list = history.get(s.slug as string) ?? [];
      list.push({ day: s.day as string, avg: Number(s.avg_price), min: s.min_price == null ? null : Number(s.min_price), max: s.max_price == null ? null : Number(s.max_price), volume: Number(s.volume ?? 0) });
      history.set(s.slug as string, list);
    }
  }
  const hist = (slug: string) => history.get(slug) ?? [];

  // how each item's price sits against its own 30-day record (asking prices are compared with asking-equivalent "normal", not raw sold prices)
  const levels: Level[] = ((lv ?? []) as Record<string, unknown>[]).map((r) => ({ slug: r.slug as string, typical: r.typical == null ? null : Number(r.typical), recent: r.recent == null ? null : Number(r.recent), prev: r.prev == null ? null : Number(r.prev), per_day: r.per_day == null ? null : Number(r.per_day), days: Number(r.days ?? 0) }));
  const levelBy = new Map(levels.map((l) => [l.slug, l]));
  const askOf = (slug: string) => { const p = itemPrice.get(slug); if (p) return { avg5: p.avg5, listings: p.listings }; const a = arcanePrice.get(slug); return a ? { avg5: a.avg5, listings: a.listings } : undefined; };
  const baseline = askBaseline(levels, askOf);

  // holdings, one row per item (arcanes per rank), valued like the Inventory page
  const holdings: (HoldingRow & { premiumPct: number | null; momentumPct: number | null; id: string; qty: number; unit: number | null; cost: number | null; key: string; kind: Holding["kind"]; rankLabel: string })[] = [];
  for (const o of owned) {
    let name: string, unit: number | null, kind: Holding["kind"], rankLabel = "";
    if (o.kind === "prime") {
      const part = partBy.get(o.slug); if (!part) continue;
      name = part.name; unit = itemPrice.get(o.slug)?.avg5 ?? null; kind = "part";
    } else {
      const a = arcaneBy.get(o.slug); if (!a) continue;
      const row = arcanePrice.get(o.slug);
      name = a.name; kind = "arcane"; rankLabel = o.rank > 0 ? ` (rank ${o.rank})` : "";
      unit = o.rank > 0 ? row?.max_avg5 ?? null : priceView(row, a.max_rank)?.price ?? null;
    }
    if (unit == null) continue;
    const sp = marketSpeed(hist(o.slug), now);
    // a signal needs a like-for-like price: the asking average of the item itself (rank 0), against its own normal
    const lvl = levelBy.get(o.slug), ask = o.rank === 0 ? askOf(o.slug) : undefined;
    const normal = lvl?.typical != null && lvl.days >= 15 ? lvl.typical * baseline : null;
    const premiumPct = normal && ask?.avg5 != null && ask.listings >= 3 ? Math.round((ask.avg5 / normal - 1) * 1000) / 10 : null;
    const momentumPct = lvl?.recent != null && lvl.prev != null && lvl.prev > 0 ? Math.round(((lvl.recent - lvl.prev) / lvl.prev) * 1000) / 10 : null;
    holdings.push({ premiumPct, momentumPct, id: o.id, cost: o.cost_each, key: `${o.slug}:${o.rank}`, kind, name: name + rankLabel, qty: o.qty, unit, value: Math.round(unit * o.qty * 10) / 10, share: 0, change7d: priceChange7d(hist(o.slug), now), liquidity: sp.liquidity, perDay: sp.perDay, rankLabel });
  }
  const rivenWorth = ((rivenRows ?? []) as { est_median: number | null }[]).reduce((s, r) => s + (r.est_median ?? 0), 0);
  const rivenCount = (rivenRows ?? []).length;
  const all: Holding[] = [...holdings.map((h) => ({ key: h.key, name: h.name, value: h.value, kind: h.kind, liquidity: h.liquidity })), ...(rivenWorth > 0 ? [{ key: "rivens", name: "Your rivens", value: rivenWorth, kind: "riven" as const, liquidity: "slow" as const }] : [])];
  const alloc = allocation(all);
  const rows = [...holdings].sort((a, b) => b.value - a.value).map((h) => {
    const share = alloc.total > 0 ? Math.round((h.value / alloc.total) * 1000) / 10 : 0;
    return { ...h, share, sig: signalFor({ premiumPct: h.premiumPct, momentumPct: h.momentumPct, liquidity: h.liquidity, sharePct: share }) };
  });
  const sellNow = rows.filter((r) => r.sig.signal === "sell" || r.sig.signal === "dump");
  const sellValue = Math.round(sellNow.reduce((s, r) => s + r.value, 0));

  // sets you could finish
  const primeQty = new Map<string, number>();
  for (const o of owned) if (o.kind === "prime") primeQty.set(o.slug, (primeQty.get(o.slug) ?? 0) + o.qty);
  const setPlans = planSets(primeQty, primeCatalogue.parts, (s) => { const p = itemPrice.get(s); return p ? { price: p.avg5, listings: p.listings } : undefined; });
  const SIGNAL_CLS: Record<Signal, string> = { sell: "text-ok", trim: "text-orange", hold: "text-dim", "buy-more": "text-teal", dump: "text-danger", none: "text-dim" };

  // today's snapshot (one a day), then the series
  const partsTotal = holdings.filter((h) => h.kind === "part").reduce((s, h) => s + h.value, 0), arcanesTotal = holdings.filter((h) => h.kind === "arcane").reduce((s, h) => s + h.value, 0);
  const today = new Date(now).toISOString().slice(0, 10);
  if (alloc.total > 0) {
    try { await sb.from("portfolio_snapshots").upsert({ user_id: uid, day: today, total: Math.round(alloc.total), parts: Math.round(partsTotal), arcanes: Math.round(arcanesTotal), rivens: Math.round(rivenWorth), items: holdings.reduce((s, h) => s + h.qty, 0) }, { onConflict: "user_id,day" }); } catch { /* the chart just misses a point */ }
  }
  const series = [...((snapRows ?? []) as { day: string; total: number }[]).filter((s) => s.day !== today)].reverse();
  if (alloc.total > 0) series.push({ day: today, total: Math.round(alloc.total) });
  const weekAgo = series.length > 1 ? series.filter((s) => s.day <= new Date(now - 7 * 86_400_000).toISOString().slice(0, 10)).at(-1) ?? series[0] : null;
  const weekMove = weekAgo && weekAgo.day !== today ? Math.round(alloc.total) - weekAgo.total : null;

  // unrealised profit: only on holdings where you entered what you paid
  const costed = holdings.filter((h) => h.cost != null);
  const costPaid = costed.reduce((s, h) => s + (h.cost as number) * h.qty, 0);
  const costedValue = costed.reduce((s, h) => s + h.value, 0);
  const unrealised = Math.round(costedValue - costPaid);

  // profit
  const sales: Sale[] = ((saleRows ?? []) as Record<string, unknown>[]).map((r) => ({ item_name: r.item_name as string, qty: Number(r.qty), price_each: Number(r.price_each), cost_each: r.cost_each == null ? null : Number(r.cost_each), sold_at: r.sold_at as string, status: r.status as string }));
  const p30 = profit(sales, now, 30), pAll = profit(sales, now);
  const nameToPrice = new Map<string, number>();
  for (const p of primeCatalogue.parts) { const v = itemPrice.get(p.slug)?.avg5; if (v != null) nameToPrice.set(p.name.toLowerCase(), v); }
  for (const a of arcanes) { const v = priceView(arcanePrice.get(a.slug), a.max_rank)?.price; if (v != null) nameToPrice.set(a.name.toLowerCase(), v); }
  const against = vsMarket(sales, (n) => nameToPrice.get(n.toLowerCase()) ?? null).slice(0, 6);

  // watchlist rows
  const wl: WatchRow[] = watch.map((w) => {
    const h = hist(w.slug);
    const price = w.kind === "prime" ? itemPrice.get(w.slug)?.avg5 ?? null : (() => { const a = arcaneBy.get(w.slug); return a ? priceView(arcanePrice.get(w.slug), a.max_rank)?.price ?? null : null; })();
    const listings = w.kind === "prime" ? itemPrice.get(w.slug)?.listings ?? 0 : arcanePrice.get(w.slug)?.listings ?? 0;
    const sp = marketSpeed(h, now);
    return { slug: w.slug, name: w.name, kind: w.kind, price, listings, change7d: priceChange7d(h, now), liquidity: sp.liquidity, perDay: sp.perDay, spark: h.slice(-14).map((d) => d.avg) };
  });
  const options: WatchOption[] = [
    ...primeCatalogue.parts.map((p): WatchOption => ({ slug: p.slug, name: p.name, kind: "prime" })),
    ...arcanes.map((a): WatchOption => ({ slug: a.slug, name: a.name, kind: "arcane" })),
  ];

  const tips = insights(rows, alloc);
  const empty = alloc.total === 0;

  return (
    <div className="space-y-6">
      <PageHeader kicker="Your money" title="My portfolio">
        <Link href="/inventory" className="btn">Edit inventory</Link>
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label="Portfolio value" value={fmt(Math.round(alloc.total))} plat sub={`${holdings.reduce((s, h) => s + h.qty, 0)} items${rivenCount ? ` + ${rivenCount} riven${rivenCount === 1 ? "" : "s"}` : ""}`} />
        <Tile label="Vs a week ago" value={weekMove == null ? "—" : signed(weekMove)} tone={weekMove == null ? undefined : weekMove >= 0 ? "up" : "down"} sub={weekMove == null ? "needs a week of visits" : "platinum"} />
        <Tile label="Earned, 30 days" value={fmt(p30.revenue)} plat sub={p30.cost > 0 ? `profit ${signed(p30.profit)}p on costed sales` : `${p30.units} units sold`} />
        <Tile label="Unrealised profit" value={costed.length ? signed(unrealised) : "—"} plat={costed.length > 0} tone={costed.length ? (unrealised >= 0 ? "up" : "down") : undefined} sub={costed.length ? `on ${costed.length} holding${costed.length === 1 ? "" : "s"} you entered a cost for (${costPaid > 0 ? `${signed(Math.round((unrealised / costPaid) * 100))}%` : "—"})` : "add what you paid in the table below"} />
        <Tile label="Tied up in slow items" value={`${alloc.slowShare}%`} sub={`${fmt(alloc.slowValue)}p that sells under 1 a day`} tone={alloc.slowShare >= 30 ? "down" : undefined} />
      </section>

      {empty ? (
        <div className="card space-y-2 text-sm text-dim">
          <p>Nothing to value yet. Add your Prime parts and arcanes in your inventory (the screenshot scanner is the fastest way) and this page fills in.</p>
          <div className="flex gap-2"><Link href="/inventory/scan" className="btn-primary">Scan my inventory</Link><Link href="/inventory" className="btn">Add by hand</Link></div>
        </div>
      ) : (
        <>
          {tips.length > 0 && (
            <section className="card space-y-2">
              <h2 className="kicker">What stands out</h2>
              <ul className="space-y-2 text-sm text-ink">{tips.map((t) => <li key={t} className="flex gap-2"><span className="text-gold">▸</span><span>{t}</span></li>)}</ul>
            </section>
          )}

          <section className="card space-y-3">
            <h2 className="kicker">Value over time</h2>
            <ValueLine points={series} />
          </section>

          <section className="card space-y-4">
            <h2 className="kicker">Where your platinum is</h2>
            <SplitBar parts={[{ label: "Prime parts", pct: alloc.parts, cls: "bg-gold" }, { label: "Arcanes", pct: alloc.arcanes, cls: "bg-cyan-400" }, { label: "Rivens", pct: alloc.rivens, cls: "bg-plat" }]} />
            <div>
              <p className="mb-1 text-xs text-dim">Biggest holdings — {alloc.top3}% of the value is in the top 3</p>
              <ul className="space-y-1.5">
                {alloc.top.map((h) => (
                  <li key={h.key} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
                    <div className="min-w-0"><div className="flex justify-between gap-2"><span className="truncate text-ink">{h.name}</span><span className="text-dim">{h.share}%</span></div><div className="mt-1 h-1.5 bg-panel-2"><div className="h-full bg-gold/70" style={{ width: `${Math.min(100, h.share)}%` }} /></div></div>
                    <span className="flex items-center gap-1 text-plat">{fmt(Math.round(h.value))}<Plat size={12} /></span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="card space-y-2">
            <h2 className="kicker">Sell signals</h2>
            <p className="text-xs text-dim">Rules, not predictions: <b className="text-ink">Sell now</b> = 10%+ above its normal price; <b className="text-ink">Get out</b> = slow seller, under its normal price and still falling; <b className="text-ink">Hold — cheap</b> = 10%+ under normal but a steady or fast seller, so don’t sell it at a discount; <b className="text-ink">Trim</b> = 35%+ of your portfolio. “Normal” is the item’s own 30-day record, adjusted for how asking prices sit against sold prices. Hover a signal for why. Rank 1+ arcanes get no signal (we only keep rank-0 history).</p>
            {sellNow.length === 0 ? <p className="text-sm text-dim">Nothing is flagged to sell right now.</p> : (
              <ul className="divide-y divide-line text-sm">
                {sellNow.slice(0, 8).map((r) => (
                  <li key={r.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5">
                    <span className="text-ink"><b className={SIGNAL_CLS[r.sig.signal]}>{SIGNAL_LABEL[r.sig.signal]}</b> · {r.name} <span className="text-xs text-dim">× {r.qty}</span></span>
                    <span className="text-xs text-dim">{r.sig.reasons[0]} <b className="text-plat">{fmt(Math.round(r.value))}p</b></span>
                  </li>
                ))}
              </ul>
            )}
            {sellNow.length > 0 && <p className="text-xs text-dim">{sellNow.length} holding{sellNow.length === 1 ? "" : "s"} flagged, worth {fmt(sellValue)}p together.</p>}
          </section>

          <section className="card space-y-3">
            <h2 className="kicker">Holdings — how fast each one sells</h2>
            <p className="text-xs text-dim">“Per day” is how many units of that item sell across all of Warframe Market, averaged over the last two weeks. The higher it is, the sooner you can turn your stack into platinum. 7-day change compares sold prices this week with last week.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-sm">
                <thead><tr className="text-left text-xs text-dim"><th className="py-1 font-normal">Item</th><th className="font-normal">Qty</th><th className="text-right font-normal">Each</th><th className="text-right font-normal">Total</th><th className="pl-3 font-normal">Paid</th><th className="text-right font-normal">Profit</th><th className="pl-3 font-normal">7 days</th><th className="font-normal">Sells</th><th className="text-right font-normal">Share</th><th className="pl-3 font-normal">Signal</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {rows.map((h) => (
                    <tr key={h.key}>
                      <td className="max-w-[14rem] truncate py-2 text-ink">{h.name}</td>
                      <td className="text-dim">{h.qty}</td>
                      <td className="text-right text-dim">{h.unit}</td>
                      <td className="text-right text-plat">{fmt(Math.round(h.value))}</td>
                      <td className="pl-3"><CostCell id={h.id} cost={h.cost} /></td>
                      <td className={`text-right text-xs ${h.cost == null ? "text-dim" : h.value - h.cost * h.qty >= 0 ? "text-ok" : "text-danger"}`}>{h.cost == null ? "—" : signed(Math.round(h.value - h.cost * h.qty))}</td>
                      <td className="pl-3"><Change pct={h.change7d} /></td>
                      <td><LiquidityBadge liquidity={h.liquidity} perDay={h.perDay} /></td>
                      <td className="text-right text-xs text-dim">{h.share}%</td>
                      <td className="pl-3"><span className={`whitespace-nowrap text-xs font-semibold ${SIGNAL_CLS[h.sig.signal]}`} title={h.sig.reasons.join(" ")}>{SIGNAL_LABEL[h.sig.signal]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card space-y-3">
            <h2 className="kicker">Sets you could finish</h2>
            <p className="text-xs text-dim">For each Prime set you hold at least one part of: what the missing parts cost at today’s asking prices, what the parts you hold are worth sold separately, and what the finished set sells for. <b className="text-ink">Gain</b> = set price − missing parts − your parts sold loose. Each missing part is one trade, so a long list costs time. Asking prices only; check the listings before you buy.</p>
            {setPlans.length === 0 ? <p className="text-sm text-dim">No Prime sets with enough priced parts to plan. Add parts in your inventory.</p> : (
              <ul className="space-y-2">
                {setPlans.filter((p) => p.gain > 0 || p.complete).slice(0, 10).map((p) => (
                  <li key={p.setSlug} className="rounded-sm border border-line p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm text-ink">{p.name.replace(/ Set$/, "")} <span className="text-xs text-dim">· {p.completePct}% complete{p.thin ? " · thin market" : ""}</span></p>
                      <span className={`h-display text-lg ${p.gain >= 0 ? "text-ok" : "text-danger"}`}>{p.gain >= 0 ? "+" : "−"}{fmt(Math.abs(p.gain))}p</span>
                    </div>
                    <p className="text-xs text-dim">{p.complete ? <>You hold every part — selling it assembled gets <b className="text-plat">{fmt(p.setPrice)}p</b> against {fmt(p.ownedValue)}p loose.</> : <>Buy {p.missing.map((m) => `${m.qty > 1 ? `${m.qty}× ` : ""}${m.name.replace(/^.* Prime /, "")} (${fmt(m.price)}p)`).join(", ")} = <b className="text-plat">{fmt(p.missingCost)}p</b> in {p.trades} trade{p.trades === 1 ? "" : "s"}; the set sells for <b className="text-plat">{fmt(p.setPrice)}p</b>, your parts alone for {fmt(p.ownedValue)}p.</>}</p>
                  </li>
                ))}
                {setPlans.filter((p) => p.gain > 0 || p.complete).length === 0 && <li className="text-sm text-dim">Finishing any of your partial sets would cost more than it earns right now.</li>}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="kicker">Profit</h2><Link href="/inventory/sales" className="text-xs text-gold hover:underline">Log a sale →</Link></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Revenue, all time" value={fmt(pAll.revenue)} plat sub={`${pAll.units} units`} />
          <Tile label="Profit, all time" value={pAll.cost > 0 ? signed(pAll.profit) : "—"} plat={pAll.cost > 0} tone={pAll.cost > 0 ? (pAll.profit >= 0 ? "up" : "down") : undefined} sub={pAll.cost > 0 ? `${pAll.margin}% on what you paid` : "add what you paid when logging a sale"} />
          <Tile label="Sales with a cost" value={`${pAll.costedShare}%`} sub="profit counts only these" />
          <Tile label="Realised vs unrealised" value={pAll.revenue + alloc.total > 0 ? `${Math.round((pAll.revenue / (pAll.revenue + alloc.total)) * 100)}%` : "—"} sub="of your total value is already in platinum" />
        </div>
        {against.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-dim">What you sold at against the market price today</p>
            <ul className="divide-y divide-line text-sm">
              {against.map((a) => (
                <li key={a.name} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span className="text-ink">{a.name} <span className="text-xs text-dim">· {a.units} sold</span></span>
                  <span className="text-xs text-dim">you averaged <b className="text-plat">{a.soldAvg}p</b> · now {a.now}p · <span className={a.diffPct >= 0 ? "text-ok" : "text-danger"}>{a.diffPct >= 0 ? "above" : "below"} by {Math.abs(a.diffPct)}%</span></span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {sales.length === 0 && <p className="text-sm text-dim">No sales logged yet. Add them by hand (or let the site detect them from your Warframe Market orders) and your earnings and profit show up here.</p>}
      </section>

      <Watchlist rows={wl} options={options} />
    </div>
  );
}
