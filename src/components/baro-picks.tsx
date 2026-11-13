"use client";

import { useMemo, useState } from "react";
import { Plat } from "@/components/brand";
import { Segmented } from "@/components/segmented";
import { baroTip, platPer100Ducats, projectPrice, type Confidence, type Horizon } from "@/lib/baro/analysis";

export interface BaroRow {
  name: string; ducats: number | null; credits: number | null; slug: string | null;
  priceNow: number | null; /** usual price in the week before Baro arrived */ pre: number | null; listings: number; ratioShort: number | null; ratioLong: number | null; dipShare: number | null; cycles: number; confidence: Confidence;
  /** false until the server has worked this item out */
  ready: boolean;
}

type SortKey = "price" | "ducats";
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const CONF: Record<Confidence, { label: string; cls: string }> = {
  strong: { label: "reliable pattern", cls: "border-ok/50 text-ok" },
  some: { label: "some history", cls: "border-teal/50 text-teal" },
  weak: { label: "little history", cls: "border-orange/50 text-orange" },
  none: { label: "no history", cls: "border-line text-dim" },
};
/** An item is "recommended" when the projected sale beats today's price by this much. */
const MIN_GAIN = 0.05;

/** Baro's tradable stock with how each item's price has behaved after his past visits — two independent filters: how long you'd hold it, and what to sort by. */
export function BaroPicks({ rows }: { rows: BaroRow[] }) {
  const [horizon, setHorizon] = useState<Horizon>("short");
  const [sort, setSort] = useState<SortKey>("price");
  const [q, setQ] = useState("");

  const enriched = useMemo(() => rows.map((r) => {
    const a = { pre: r.pre, ratioShort: r.ratioShort, ratioLong: r.ratioLong, dipShare: r.dipShare, cycles: r.cycles, confidence: r.confidence };
    const sell = (h: Horizon) => projectPrice(a, h);
    const at = sell(horizon);
    return {
      ...r, sellShort: sell("short"), sellLong: sell("long"), sellAt: at,
      gain: at != null && r.priceNow ? at / r.priceNow - 1 : null,
      per100: platPer100Ducats(at, r.ducats), tip: baroTip(r.priceNow, a),
    };
  }), [rows, horizon]);

  const tradable = enriched.filter((r) => r.slug);
  const untradable = enriched.filter((r) => !r.slug);
  const needle = q.trim().toLowerCase();
  const key = (r: (typeof enriched)[number]) => (sort === "price" ? r.sellAt : r.per100);
  const list = tradable.filter((r) => !needle || r.name.toLowerCase().includes(needle)).sort((a, b) => (key(b) ?? -1) - (key(a) ?? -1) || a.name.localeCompare(b.name));
  const picks = list.filter((r) => r.gain != null && r.gain >= MIN_GAIN && r.sellAt != null && r.confidence !== "none").slice(0, 3);
  const pending = tradable.filter((r) => !r.ready).length;

  return (
    <div className="space-y-5">
      <section className="card space-y-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="label">How long you’d hold it</p>
            <Segmented<Horizon> label="Hold time" value={horizon} onChange={setHorizon} options={[{ value: "short", label: "Short — within a week" }, { value: "long", label: "Long — 2+ weeks" }]} />
          </div>
          <div className="space-y-1.5">
            <p className="label">Sort by</p>
            <Segmented<SortKey> label="Sort by" value={sort} onChange={setSort} options={[{ value: "price", label: "Sell price" }, { value: "ducats", label: "Value per ducat" }]} />
          </div>
        </div>
        <input className="input" type="search" placeholder="Search Baro’s stock…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <p className="text-xs text-dim">
          {horizon === "short" ? "Short: the price in the week after Baro leaves (days 3–8)." : "Long: the price two to four weeks out (days 14–28)."} Each is the item’s usual price in the week before Baro arrived × how much it has typically been worth in that window after his last visits (so a price Baro has just pushed down doesn’t hide the rebound). {sort === "ducats" ? "Value per ducat = platinum you’d get for every 100 ducats spent." : ""} Asking prices from online / in-game sellers only; not a guarantee.
        </p>
        {pending > 0 && <p className="text-xs text-teal" role="status">Still working out {pending} item{pending === 1 ? "" : "s"} (live prices and 90-day history)…</p>}
      </section>

      <section className="space-y-3">
        <h2 className="kicker">Recommended pickups</h2>
        {picks.length === 0 ? (
          <p className="card text-sm text-dim">{pending > 0 ? "Working these out…" : "Nothing clearly beats its current price at this hold time. Try the other hold time, or see the full list below."}</p>
        ) : (
          <ol className="grid gap-3 md:grid-cols-3">
            {picks.map((r, i) => (
              <li key={r.name} className="card-glow space-y-2">
                <p className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-gold">#{i + 1} pick</p>
                <h3 className="font-display text-lg font-bold">{r.name}</h3>
                <p className="text-sm text-dim">Costs {r.credits != null ? `${r.credits.toLocaleString("en-US")} credits` : "—"} + {r.ducats ?? "—"} ducats</p>
                <p className="h-display flex items-center gap-1.5 text-2xl text-ok">≈ {fmt(r.sellAt as number)} <Plat size={18} /> <span className="text-sm font-normal text-dim">+{Math.round((r.gain as number) * 100)}% vs {fmt(r.priceNow as number)}p now</span></p>
                <p className="text-sm leading-relaxed text-dim">{r.tip}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="kicker">All tradable items ({list.length})</h2>
        <ul className="space-y-2">
          {list.map((r) => (
            <li key={r.name} className="tile space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold">{r.name}{picks.some((p) => p.name === r.name) && <span className="ml-2 text-xs font-normal text-gold">★ recommended</span>}</p>
                  <p className="text-sm text-dim">{r.credits != null ? r.credits.toLocaleString("en-US") : "—"} credits · {r.ducats ?? "—"} ducats</p>
                </div>
                <div className="text-right text-sm">
                  {r.priceNow != null ? <p className="text-dim">now <span className="text-plat">{fmt(r.priceNow)}p</span>{r.listings < 3 ? " · thin market" : ""}{r.pre != null && <> · usual <span className="text-plat">{fmt(r.pre)}p</span></>}</p> : <p className="text-dim">{r.ready ? "no online listings" : "pricing…"}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Stat label="Sell in ~1 wk" value={r.sellShort != null ? `${fmt(r.sellShort)}p` : "—"} active={horizon === "short"} />
                <Stat label="Sell in 2–4 wk" value={r.sellLong != null ? `${fmt(r.sellLong)}p` : "—"} active={horizon === "long"} />
                <Stat label="Plat per 100 ducats" value={r.per100 != null ? fmt(r.per100) : "—"} active={sort === "ducats"} />
                <Stat label="Gain vs now" value={r.gain != null ? `${r.gain > 0 ? "+" : ""}${Math.round(r.gain * 100)}%` : "—"} tone={r.gain == null || Math.abs(r.gain) < MIN_GAIN ? "" : r.gain > 0 ? "text-ok" : "text-danger"} />
              </div>
              <p className="text-sm leading-relaxed text-dim">{r.tip}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`chip ${CONF[r.confidence].cls}`}>{CONF[r.confidence].label}{r.cycles > 0 && ` · ${r.cycles} visits`}</span>
                {r.slug && <a className="text-dim hover:text-teal" href={`https://warframe.market/items/${r.slug}`} target="_blank" rel="noopener noreferrer">warframe.market ↗</a>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {untradable.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm text-dim">Not tradable on Warframe Market ({untradable.length}) — cosmetics, boosters and the like</summary>
          <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {untradable.map((r) => <li key={r.name} className="flex justify-between gap-3"><span className="truncate text-ink">{r.name}</span><span className="shrink-0 text-dim">{r.ducats ?? "—"}d · {r.credits != null ? r.credits.toLocaleString("en-US") : "—"}cr</span></li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

function Stat({ label, value, active = false, tone = "" }: { label: string; value: string; active?: boolean; tone?: string }) {
  return <div className={active ? "rounded border border-gold/40 bg-gold/5 px-2 py-1" : "px-2 py-1"}><p className="text-xs text-dim">{label}</p><p className={`h-display text-base ${tone || (active ? "text-gold" : "text-ink")}`}>{value}</p></div>;
}
