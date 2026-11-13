"use client";

import { useMemo, useState } from "react";
import { Plat } from "@/components/brand";
import { PriceChart } from "@/components/price-chart";
import { Segmented } from "@/components/segmented";
import { backed, baroTip, cycleStats, evidence, platPer100Ducats, projectPrice, dipRecovery, type Confidence, type Horizon, type DipRecovery } from "@/lib/baro/analysis";
import { bestBasket } from "@/lib/baro/basket";
import type { SalesDay } from "@/lib/history-sales";

export interface BaroRow {
  name: string; ducats: number | null; credits: number | null; slug: string | null;
  priceNow: number | null; /** usual price in the week before Baro arrived */ pre: number | null;
  listings: number; ratioShort: number | null; ratioLong: number | null; shortHits: number; shortN: number; longHits: number; longN: number; dipShare: number | null; cycles: number; confidence: Confidence;
  /** false until the server has worked this item out */
  ready: boolean;
}

type SortKey = "price" | "ducats" | "gain";
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const cr = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-US"));
const CONF: Record<Confidence, { label: string; cls: string }> = {
  strong: { label: "reliable pattern", cls: "border-ok/50 text-ok" },
  some: { label: "some history", cls: "border-teal/50 text-teal" },
  weak: { label: "little history", cls: "border-orange/50 text-orange" },
  none: { label: "no history", cls: "border-line text-dim" },
};
/** An item is a "buy" when the projected sale beats today's price by this much. */
const MIN_GAIN = 0.05;

type Verdict = "buy" | "skip" | "flat" | "unknown";
const VERDICT: Record<Verdict, { label: string; cls: string }> = {
  buy: { label: "Buy & hold", cls: "border-ok/60 bg-ok/10 text-ok" },
  skip: { label: "Skip / sell fast", cls: "border-danger/50 bg-danger/10 text-danger" },
  flat: { label: "No real edge", cls: "border-line text-dim" },
  unknown: { label: "Not enough data", cls: "border-line text-dim" },
};

/** Baro's tradable stock: two independent filters (how long you'd hold it, what to sort by), a budget planner, recommended pickups, and per-item detail with a chart that marks his past visits. */
export function BaroPicks({ rows, history, arrival }: { rows: BaroRow[]; history: Record<string, SalesDay[]>; arrival: string }) {
  const [horizon, setHorizon] = useState<Horizon>("short");
  const [sort, setSort] = useState<SortKey>("price");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [ducats, setDucats] = useState("");
  const [credits, setCredits] = useState("");

  // How far the cheapest trades dipped on past visits and how long they took to come back — straight from the sales records.
  const recovery = useMemo(() => {
    const out: Record<string, DipRecovery> = {};
    for (const r of rows) if (r.slug) out[r.name] = dipRecovery((history[r.slug] ?? []).map((h) => ({ day: h.day, min: h.min, avg: h.avg })), arrival);
    return out;
  }, [rows, history, arrival]);

  const enriched = useMemo(() => rows.map((r) => {
    const a = { pre: r.pre, ratioShort: r.ratioShort, ratioLong: r.ratioLong, shortHits: r.shortHits, shortN: r.shortN, longHits: r.longHits, longN: r.longN, dipShare: r.dipShare, cycles: r.cycles, confidence: r.confidence };
    const sell = (h: Horizon) => projectPrice(a, h);
    const at = sell(horizon);
    const gain = at != null && r.priceNow ? at / r.priceNow - 1 : null;
    const verdict: Verdict = at == null || r.priceNow == null || r.confidence === "none" ? "unknown" : gain != null && gain >= MIN_GAIN && backed(a, horizon) ? "buy" : gain != null && gain <= -MIN_GAIN ? "skip" : "flat";
    return { ...r, sellShort: sell("short"), sellLong: sell("long"), sellAt: at, gain, verdict, per100: platPer100Ducats(at, r.ducats), tip: baroTip(r.priceNow, a), evShort: evidence(a, "short"), evLong: evidence(a, "long") };
  }), [rows, horizon]);

  const tradable = enriched.filter((r) => r.slug);
  const untradable = enriched.filter((r) => !r.slug);
  const needle = q.trim().toLowerCase();
  const key = (r: (typeof enriched)[number]) => (sort === "price" ? r.sellAt : sort === "ducats" ? r.per100 : r.gain);
  const list = tradable.filter((r) => !needle || r.name.toLowerCase().includes(needle)).sort((a, b) => (key(b) ?? -Infinity) - (key(a) ?? -Infinity) || a.name.localeCompare(b.name));
  // best use of ducats, whatever the filters say: platinum back per 100 ducats at the expected (usual) sell price
  const byDucats = tradable.filter((r) => r.per100 != null && r.ducats).sort((a, b) => (b.per100 as number) - (a.per100 as number)).slice(0, 8);
  const topPer100 = byDucats[0]?.per100 ?? 1;
  const picks = list.filter((r) => r.verdict === "buy").slice(0, 3);
  const pending = tradable.filter((r) => !r.ready).length;
  const discounted = tradable.filter((r) => r.pre != null && r.priceNow != null && r.priceNow <= r.pre * 0.85).length;

  const budgetD = Number(ducats) > 0 ? Number(ducats) : null, budgetC = Number(credits) > 0 ? Number(credits) : null;
  const basket = budgetD == null && budgetC == null ? null : bestBasket(
    tradable.filter((r) => r.verdict === "buy" && r.sellAt != null && r.ducats != null && r.credits != null).map((r) => ({ name: r.name, ducats: r.ducats as number, credits: r.credits as number, value: r.sellAt as number })),
    { ducats: budgetD, credits: budgetC });

  return (
    <div className="space-y-6">
      {/* at a glance */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Glance label="Items for sale" value={String(rows.length)} sub={`${tradable.length} tradable`} />
        <Glance label="Below usual price" value={String(discounted)} sub="15%+ cheaper than usual" />
        <Glance label="Buy & hold picks" value={String(tradable.filter((r) => r.verdict === "buy").length)} sub={horizon === "short" ? "for a ~1 week hold" : "for a 2–4 week hold"} />
        <Glance label="Top pick" value={picks[0]?.name ?? "—"} sub={picks[0]?.sellAt != null ? `≈ ${fmt(picks[0].sellAt)}p` : pending > 0 ? "working it out…" : "none right now"} small />
      </section>

      {/* the two filters */}
      <section className="card space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className="space-y-1.5">
            <p className="label">How long you’d hold it</p>
            <Segmented<Horizon> label="Hold time" value={horizon} onChange={setHorizon} options={[{ value: "short", label: "Short · within a week" }, { value: "long", label: "Long · 2+ weeks" }]} />
            <p className="text-xs text-dim">{horizon === "short" ? "Only items whose price was back to usual within a week of past visits are picks." : "Items whose price was back to usual within 2–4 weeks of past visits are picks."}</p>
          </div>
          <div className="space-y-1.5">
            <p className="label">Sort by</p>
            <Segmented<SortKey> label="Sort by" value={sort} onChange={setSort} options={[{ value: "price", label: "Sell price" }, { value: "ducats", label: "Per ducat" }, { value: "gain", label: "Gain" }]} />
            <p className="text-xs text-dim">{sort === "price" ? "Highest projected sale price first." : sort === "ducats" ? "Platinum you’d get per 100 ducats spent." : "Biggest jump from today’s price first."}</p>
          </div>
        </div>
        <input className="input" type="search" placeholder="Search Baro’s stock…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        {pending > 0 && <p className="text-xs text-teal" role="status">Still working out {pending} item{pending === 1 ? "" : "s"} (live prices and 90-day history)…</p>}
      </section>

      {/* budget planner */}
      <section className="card space-y-3">
        <h2 className="kicker">What should I buy with what I have?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="b-ducats">My ducats</label><input id="b-ducats" className="input" type="number" min={0} inputMode="numeric" placeholder="e.g. 1500" value={ducats} onChange={(e) => setDucats(e.target.value)} /></div>
          <div><label className="label" htmlFor="b-credits">My credits <span className="text-dim">(optional)</span></label><input id="b-credits" className="input" type="number" min={0} inputMode="numeric" placeholder="e.g. 600000" value={credits} onChange={(e) => setCredits(e.target.value)} /></div>
        </div>
        {!basket ? <p className="text-xs text-dim">Enter your ducats (and credits) and it finds the combination of “Buy & hold” items worth the most platinum at the hold time you picked, one of each.</p>
          : basket.items.length === 0 ? <p className="text-sm text-dim">Nothing worth buying fits that budget at this hold time.</p>
          : (
            <div className="space-y-2">
              <ul className="space-y-1 text-sm">{basket.items.map((i) => <li key={i.name} className="flex justify-between gap-3"><span className="text-ink">{i.name}</span><span className="shrink-0 text-dim">{i.ducats}d · {cr(i.credits)}cr · <span className="text-plat">≈ {fmt(i.value)}p</span></span></li>)}</ul>
              <p className="border-t border-line pt-2 text-sm text-ink">Spend <b>{basket.ducats} ducats</b> and <b>{cr(basket.credits)} credits</b> → projected <b className="text-plat">≈ {fmt(basket.value)}p</b> {horizon === "short" ? "within a week" : "after 2–4 weeks"} (≈ {fmt(Math.round((basket.value / basket.ducats) * 1000) / 10)}p per 100 ducats).</p>
            </div>
          )}
      </section>

      {/* recommended */}
      <section className="space-y-3">
        <h2 className="kicker">Recommended pickups</h2>
        {picks.length === 0 ? (
          <p className="card text-sm text-dim">{pending > 0 ? "Working these out…" : "Nothing clearly beats its current price at this hold time. Try the other hold time, or look through the full list below."}</p>
        ) : (
          <ol className="grid gap-3 md:grid-cols-3">
            {picks.map((r, i) => (
              <li key={r.name} className="card-glow space-y-2">
                <p className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-gold">#{i + 1} pick</p>
                <h3 className="font-display text-lg font-bold leading-tight">{r.name}</h3>
                <p className="text-sm text-dim">{cr(r.credits)} credits + {r.ducats ?? "—"} ducats</p>
                <p className="h-display flex flex-wrap items-baseline gap-x-2 text-2xl text-ok">≈ {fmt(r.sellAt as number)} <Plat size={18} /> <span className="text-sm font-normal text-dim">+{Math.round((r.gain as number) * 100)}% vs {fmt(r.priceNow as number)}p now</span></p>
                <p className="text-sm leading-relaxed text-dim">{r.tip}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* best ducat value */}
      <section className="space-y-3">
        <h2 className="kicker">Best value for your ducats</h2>
        {byDucats.length === 0 ? (
          <p className="card text-sm text-dim">{pending > 0 ? "Working these out…" : "Not enough sales records to rank the items yet."}</p>
        ) : (
          <div className="card space-y-3">
            <ol className="space-y-2">
              {byDucats.map((r, i) => (
                <li key={r.name} className="space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="text-sm text-ink"><span className="mr-2 font-mono text-dim">{i + 1}</span>{r.name}</p>
                    <p className="text-sm text-dim"><span className="h-display normal-case text-plat">{fmt(r.per100 as number)}p</span> per 100 ducats · {r.ducats} ducats → ≈ {fmt(r.sellAt as number)}p <span className="text-xs">({fmt(Math.round(((r.ducats as number) / (r.sellAt as number)) * 10) / 10)} ducats per plat{r.credits != null ? `, ${cr(r.credits)} credits` : ""})</span></p>
                  </div>
                  <div className="h-1.5 w-full bg-line/60" aria-hidden="true"><div className="h-full bg-teal" style={{ width: `${Math.max(4, ((r.per100 as number) / (topPer100 as number)) * 100)}%` }} /></div>
                </li>
              ))}
            </ol>
            <p className="text-xs text-dim">Platinum you’d get back for every 100 ducats spent, at each item’s expected sell price (what it sold for in the week before Baro arrived — only items with enough sales records are ranked). For scale, Prime parts are only worth turning into ducats at about 10 ducats per platinum, so anything here at 10p per 100 ducats or better is in that league; higher is better. It ignores credits — check the credit cost too.</p>
          </div>
        )}
      </section>

      {/* everything */}
      <section className="space-y-3">
        <h2 className="kicker">All tradable items ({list.length})</h2>
        <ul className="space-y-3">
          {list.map((r) => {
            const isOpen = open === r.name;
            const hist = (r.slug && history[r.slug]) || [];
            const visits = isOpen ? cycleStats(hist.map((h) => ({ day: h.day, price: h.avg })), arrival) : [];
            const max = Math.max(...[r.priceNow, r.sellAt].filter((v): v is number => v != null), 1);
            return (
              <li key={r.name} className="tile space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-bold leading-tight">{r.name}</h3>
                    <p className="mt-0.5 text-sm text-dim">{cr(r.credits)} credits · {r.ducats ?? "—"} ducats{r.per100 != null && <> · <span className="text-plat">{fmt(r.per100)}p</span> per 100 ducats</>}</p>
                  </div>
                  <span className={`shrink-0 border px-2.5 py-1 font-display text-xs font-semibold uppercase tracking-[0.08em] ${VERDICT[r.verdict].cls}`}>{VERDICT[r.verdict].label}</span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                  <Bar label="Asking now" value={r.priceNow} max={max} tone="bg-orange" sub={r.priceNow == null ? (r.ready ? "no listings" : "pricing…") : r.listings < 3 ? "thin market" : "5 cheapest online"} />
                  <Bar label="Expected sell price" value={r.sellAt} max={max} tone="bg-ok" active sub={r.sellAt != null ? "sold the week before Baro" : "not enough visits"} />
                  <div className="p-1.5"><p className="text-xs text-dim">vs asking now</p><p className={`h-display text-xl normal-case ${r.gain == null ? "text-dim" : r.gain >= MIN_GAIN ? "text-ok" : r.gain <= -MIN_GAIN ? "text-danger" : "text-ink"}`}>{r.gain == null ? "—" : `${r.gain > 0 ? "+" : ""}${Math.round(r.gain * 100)}%`}</p><p className="mt-1 text-xs text-dim">{r.sellAt != null && r.priceNow != null ? `${fmt(r.priceNow)}p → ${fmt(r.sellAt)}p` : ""}</p></div>
                  <Recover dip={recovery[r.name] ?? null} />
                </div>

                <p className="text-sm leading-relaxed text-dim">{r.tip}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`chip ${CONF[r.confidence].cls}`}>{CONF[r.confidence].label}{r.cycles > 0 && ` · ${r.cycles} visits`}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    {r.slug && <a className="text-dim hover:text-teal" href={`https://warframe.market/items/${r.slug}`} target="_blank" rel="noopener noreferrer">warframe.market ↗</a>}
                    <button className="btn min-h-8 px-3 text-xs" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.name)}>{isOpen ? "Hide details" : "Details & chart"}</button>
                  </span>
                </div>

                {isOpen && (
                  <div className="space-y-4 border-t border-line pt-4">
                    <div>
                      <h4 className="label">What happened on his last visits</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[30rem] text-sm">
                          <thead><tr className="text-left text-xs text-dim"><th className="py-1 pr-3 font-normal">Baro arrived</th><th className="py-1 pr-3 font-normal">Week before</th><th className="py-1 pr-3 font-normal">While here</th><th className="py-1 pr-3 font-normal">Week after</th><th className="py-1 font-normal">2–4 weeks</th></tr></thead>
                          <tbody>
                            {visits.map((v) => (
                              <tr key={v.arrival} className="border-t border-line/60">
                                <td className="py-1.5 pr-3 text-dim">{v.arrival}</td>
                                <Cell v={v.pre} />
                                <Cell v={v.during} dim={v.pre != null && v.during != null && v.during <= v.pre * 0.98 ? "dip" : undefined} />
                                <Cell v={v.short} />
                                <Cell v={v.long} />
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-1 text-xs text-dim">Median daily price paid in each window (rank 0). “While here” is highlighted when it was lower than the week before.</p>
                    </div>
                    {r.slug && <PriceChart slug={r.slug} name={r.name} sales={hist} asking={[]} bands={visitBands(arrival)} />}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {untradable.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm text-dim">Not tradable on Warframe Market ({untradable.length}) — cosmetics, boosters and the like</summary>
          <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {untradable.map((r) => <li key={r.name} className="flex justify-between gap-3"><span className="truncate text-ink">{r.name}</span><span className="shrink-0 text-dim">{r.ducats ?? "—"}d · {cr(r.credits)}cr</span></li>)}
          </ul>
        </details>
      )}
      <p className="text-xs text-dim">Asking now = average of the 5 cheapest online / in-game asking prices at rank 0 (asking prices run a little below what things actually sell for, so a discount can look slightly bigger than it is). Usual and all history = Warframe Market’s completed trades at rank 0. Nothing is projected above the usual price, and no one can promise a future price — these are what the records support. The history can’t show whether Baro sold the item on earlier visits.</p>
    </div>
  );
}

/** Baro's visits within the 100 days we hold history for: arrival day to the day he leaves (2 days). */
function visitBands(arrival: string) {
  const a0 = Date.parse(arrival.slice(0, 10) + "T00:00:00Z"), DAY = 86_400_000;
  return Array.from({ length: 8 }, (_, i) => {
    const start = a0 - 14 * i * DAY;
    return { from: new Date(start).toISOString().slice(0, 10), to: new Date(start + 2 * DAY).toISOString().slice(0, 10), label: i === 0 ? "Baro (now)" : "Baro" };
  });
}

function Glance({ label, value, sub, small = false }: { label: string; value: string; sub: string; small?: boolean }) {
  return (
    <div className="card !p-3.5">
      <p className="text-xs text-dim">{label}</p>
      <p className={`h-display mt-0.5 truncate ${small ? "text-lg" : "text-3xl"} text-ink`}>{value}</p>
      <p className="mt-0.5 text-xs text-dim">{sub}</p>
    </div>
  );
}

function Bar({ label, value, max, tone, sub, active = false }: { label: string; value: number | null; max: number; tone: string; sub: string; active?: boolean }) {
  return (
    <div className={active ? "rounded border border-gold/40 bg-gold/5 p-1.5" : "p-1.5"}>
      <p className="text-xs text-dim">{label}</p>
      <p className="h-display text-xl normal-case text-ink">{value != null ? <>{fmt(value)}<span className="ml-0.5 text-sm font-normal text-dim">p</span></> : "—"}</p>
      <div className="mt-1 h-1.5 w-full bg-line/60" aria-hidden="true"><div className={`h-full ${tone}`} style={{ width: `${value != null ? Math.max(4, (value / max) * 100) : 0}%` }} /></div>
      <p className="mt-1 h-4 text-xs text-dim">{sub}</p>
    </div>
  );
}

/** How long the price takes to come back after Baro's dip: one number, plus how big and how steady the dip was. */
function Recover({ dip }: { dip: DipRecovery | null }) {
  const steady = !!dip && dip.dipped >= 3 && dip.days != null;
  return (
    <div className="p-1.5">
      <p className="text-xs text-dim">Back to usual after he leaves</p>
      {steady && dip ? (
        <>
          <p className="h-display text-xl normal-case text-ink">~{dip.days}<span className="ml-0.5 text-sm font-normal text-dim"> day{dip.days === 1 ? "" : "s"}</span></p>
          <p className="mt-1 text-xs text-dim">cheapest trades dipped ~{Math.round((dip.depth ?? 0) * 100)}% in {dip.dipped} of {dip.n} visits</p>
        </>
      ) : dip && dip.n >= 4 ? (
        <>
          <p className="h-display text-xl normal-case text-dim">no steady dip</p>
          <p className="mt-1 text-xs text-dim">cheapest trades fell in only {dip.dipped} of {dip.n} visits</p>
        </>
      ) : <p className="h-display text-xl text-dim">—</p>}
    </div>
  );
}

function Cell({ v, dim }: { v: number | null; dim?: "dip" }) {
  return <td className={`py-1.5 pr-3 font-mono ${dim === "dip" ? "text-orange" : v == null ? "text-dim" : "text-ink"}`}>{v == null ? "—" : `${fmt(v)}p`}</td>;
}
