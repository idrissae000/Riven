"use client";

import { useMemo, useState } from "react";
import { Plat } from "@/components/brand";
import { PriceChart } from "@/components/price-chart";
import { Segmented } from "@/components/segmented";
import { trackSinceBaro } from "@/lib/baro/tracking";
import type { SalesDay } from "@/lib/history-sales";

export interface VarziaRow {
  name: string; regal: number | null; aya: number | null;
  /** The Warframe Market set this item is, if it is a tradable Prime set. */
  slug: string | null; setName: string | null;
  /** Average of the 5 cheapest online listings now, and how many there are. */
  askNow: number | null; listings: number;
}

type SortKey = "value" | "price" | "change";
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Varzia's Prime sets: what each costs in Regal Aya, what the set sells for, and how its price has moved since her rotation began — from the sales records only. */
export function VarziaPicks({ rows, history, activation, expiry }: { rows: VarziaRow[]; history: Record<string, SalesDay[]>; activation: string; expiry: string }) {
  const [sort, setSort] = useState<SortKey>("value");
  const [open, setOpen] = useState<string | null>(null);

  const items = useMemo(() => rows.filter((r) => r.slug).map((r) => {
    const t = trackSinceBaro(history[r.slug as string] ?? [], activation);
    const sells = t.recent ?? r.askNow; // what it sold for lately (falls back to asking)
    return { ...r, t, sells, perAya: sells != null && r.regal ? Math.round((sells / r.regal) * 10) / 10 : null };
  }), [rows, history, activation]);
  const other = rows.filter((r) => !r.slug);

  const key = (r: (typeof items)[number]) => (sort === "value" ? r.perAya : sort === "price" ? r.sells : r.t.vsUsual);
  const list = [...items].sort((a, b) => (key(b) ?? -Infinity) - (key(a) ?? -Infinity) || a.name.localeCompare(b.name));
  const best = [...items].filter((r) => r.perAya != null).sort((a, b) => (b.perAya as number) - (a.perAya as number))[0];
  const bands = [{ from: activation.slice(0, 10), to: expiry.slice(0, 10), label: "Varzia" }];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Glance label="Items for sale" value={String(rows.length)} sub={`${items.length} tradable Prime sets`} />
        <Glance label="Best per Regal Aya" value={best?.setName?.replace(/ Set$/, "") ?? "—"} sub={best?.perAya != null ? `≈ ${fmt(best.perAya)}p per Regal Aya` : "no prices yet"} small />
        <Glance label="Price drop since start" value={String(items.filter((r) => (r.t.vsUsual ?? 0) <= -5).length)} sub="sets 5%+ under their usual price" />
        <Glance label="Price rise since start" value={String(items.filter((r) => (r.t.vsUsual ?? 0) >= 5).length)} sub="sets 5%+ over their usual price" />
      </section>

      <section className="card space-y-3">
        <div className="space-y-1.5">
          <p className="label">Sort by</p>
          <Segmented<SortKey> label="Sort by" value={sort} onChange={setSort} options={[{ value: "value", label: "Plat per Regal Aya" }, { value: "price", label: "Set price" }, { value: "change", label: "Change since start" }]} />
        </div>
        <p className="text-xs text-dim">The set’s price is what it recently sold for (the median of the last 3 days of trades), or the cheapest asks if there are no recent trades. “Usual” is what it sold for in the week before her rotation began. Everything is from completed trades — nothing is projected.</p>
      </section>

      <ul className="space-y-3">
        {list.map((r) => {
          const isOpen = open === r.name;
          const cost = [r.regal != null ? `${r.regal} Regal Aya` : null, r.aya != null ? `${r.aya} Aya` : null].filter(Boolean).join(" + ") || "—";
          const t = r.t;
          return (
            <li key={r.name} className="tile space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold leading-tight">{r.setName}</h3>
                  <p className="mt-0.5 text-sm text-dim">Varzia sells it as “{r.name}” for {cost}</p>
                </div>
                {r.perAya != null && <p className="h-display text-xl normal-case text-teal">{fmt(r.perAya)}p <span className="text-sm font-normal text-dim">per Regal Aya</span></p>}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <Stat label="Sells for now" value={r.sells != null ? `${fmt(r.sells)}p` : "—"} sub={t.recent != null ? "recent sales" : r.askNow != null ? "asking (no recent sales)" : ""} />
                <Stat label="Usual (week before)" value={t.usual != null ? `${fmt(t.usual)}p` : "—"} sub="before her rotation" />
                <Stat label="Change since start" value={t.vsUsual != null ? `${t.vsUsual > 0 ? "+" : ""}${t.vsUsual}%` : "—"} tone={t.vsUsual == null || Math.abs(t.vsUsual) < 5 ? "" : t.vsUsual > 0 ? "text-ok" : "text-danger"} sub={t.peak ? `peak ${fmt(t.peak.price)}p` : ""} />
                <Stat label="Units sold / day" value={t.sinceVolume != null ? fmt(t.sinceVolume) : "—"} sub={r.listings > 0 ? `${r.listings} online listings` : ""} />
              </div>

              <div className="flex items-center justify-between gap-3 text-xs">
                {r.slug && <a className="text-dim hover:text-teal" href={`https://warframe.market/items/${r.slug}`} target="_blank" rel="noopener noreferrer">warframe.market ↗</a>}
                <button className="btn min-h-8 px-3 text-xs" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.name)}>{isOpen ? "Hide chart" : "Price chart"}</button>
              </div>
              {isOpen && r.slug && <PriceChart slug={r.slug} name={r.setName ?? r.name} sales={history[r.slug] ?? []} asking={[]} bands={bands} />}
            </li>
          );
        })}
        {list.length === 0 && <li className="card text-sm text-dim">None of her current items are tradable Prime sets we can price.</li>}
      </ul>

      {other.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm text-dim">Everything else she’s selling ({other.length}) — packs, relics, cosmetics</summary>
          <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {other.map((r) => <li key={r.name} className="flex justify-between gap-3"><span className="truncate text-ink">{r.name}</span><span className="shrink-0 text-dim">{r.regal != null ? `${r.regal} Regal Aya` : r.aya != null ? `${r.aya} Aya` : "—"}</span></li>)}
          </ul>
        </details>
      )}
      <p className="text-xs text-dim">The two cost fields come straight from the world-state feed (shown here as Regal Aya and Aya). Prices are Warframe Market’s completed trades; “Change since start” compares the last 3 days with the week before her rotation began. <Plat size={11} /> Prices can move for reasons that have nothing to do with Varzia.</p>
    </div>
  );
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
function Stat({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: string }) {
  return <div><p className="text-xs text-dim">{label}</p><p className={`h-display text-xl normal-case ${tone || "text-ink"}`}>{value}</p>{sub && <p className="text-xs text-dim">{sub}</p>}</div>;
}
