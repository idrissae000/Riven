"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { About } from "@/components/about";
import { Plat } from "@/components/brand";
import { rarityClass } from "@/lib/arcanes/style";
import type { CollectionValue } from "@/lib/arcanes/collection-value";

export interface CollectionCard {
  id: string; name: string; vosfor: number; credits: number; picks: number;
  value: CollectionValue;
}
type Metric = "avg" | "odds";

const fmt = (n: number | null, digits = 0) => (n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: digits }));

/** Loid's Arcane Collections ranked by what their arcanes are worth. `names` maps arcane slug → display name. */
export function VosforCollections({ cards, names }: { cards: CollectionCard[]; names: Record<string, string> }) {
  const [metric, setMetric] = useState<Metric>("avg");
  const sorted = useMemo(() => {
    const key = (c: CollectionCard) => (metric === "avg" ? c.value.avgPerArcane : c.value.oddsPerArcane);
    return [...cards].sort((a, b) => (key(b) ?? -1) - (key(a) ?? -1) || a.name.localeCompare(b.name));
  }, [cards, metric]);

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-dim">
            Every collection costs <b className="text-ink">200 Vosfor + 50,000 credits</b> and gives <b className="text-ink">3 arcanes</b>. Ranked by
          </p>
          <div className="flex gap-1" role="group" aria-label="Rank collections by">
            <button className={`btn min-h-9 px-3 text-xs ${metric === "avg" ? "border-gold text-gold" : ""}`} aria-pressed={metric === "avg"} onClick={() => setMetric("avg")}>Average arcane price</button>
            <button className={`btn min-h-9 px-3 text-xs ${metric === "odds" ? "border-gold text-gold" : ""}`} aria-pressed={metric === "odds"} onClick={() => setMetric("odds")}>Odds-weighted</button>
          </div>
        </div>
        <About label="What do these two numbers mean?">
          <b className="text-ink">Average arcane price</b>: add up the price of every arcane in the collection and divide by how many there are.{" "}
          <b className="text-ink">Odds-weighted</b>: the same, but counting how often each rarity actually drops (a 5% legendary counts for 5%, a 40% common for 40%) —
          the closest thing to “platinum per pack on average”. Prices are asking prices, not sales (average of the 5 cheapest online rank-0 listings); arcanes marked ÷ had too few rank-0 listings, so they’re priced as their max-rank price divided by the copies it takes to make one (21 for a rank-5 arcane); “thin” ones had too few listings and nothing to cross-check against.
        </About>
      </div>

      <ol className="space-y-3">
        {sorted.map((c, i) => {
          const v = c.value;
          const main = metric === "avg" ? v.avgPerArcane : v.oddsPerArcane;
          const other = metric === "avg" ? v.oddsPerArcane : v.avgPerArcane;
          return (
            <li key={c.id} className={`card ${i === 0 && main != null ? "border-gold/60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`font-display text-2xl font-bold ${i === 0 && main != null ? "text-gold" : "text-dim"}`}>{i + 1}</span>
                  <div>
                    <h2 className="h-display text-xl">{c.name} Collection</h2>
                    <p className="text-xs text-dim">
                      {v.priced} of {v.total} arcanes priced
                      {v.confidence !== "high" && <span className={`chip ml-2 ${v.confidence === "low" ? "border-orange/50 text-orange" : ""}`}>{v.confidence} confidence</span>}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="h-display flex items-center justify-end gap-1.5 text-3xl text-plat">≈ {fmt(main)} <Plat size={22} /></p>
                  <p className="text-xs text-dim">{metric === "avg" ? "average per arcane" : "odds-weighted per arcane"}</p>
                  <p className="mt-0.5 font-mono text-xs text-dim">
                    {metric === "avg" ? "odds-weighted" : "plain average"} {fmt(other)} · pack of {c.picks}: ≈ {fmt(v.perPack)} (odds-weighted)
                  </p>
                </div>
              </div>

              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-display text-xs font-semibold uppercase tracking-[0.1em] text-gold hover:text-ink">What’s inside</summary>
                <div className="mt-3 space-y-4">
                  {v.tiers.map((t) => (
                    <div key={t.rarity}>
                      <p className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`chip ${rarityClass(t.rarity)}`}>{t.rarity}</span>
                        <span className="text-dim">{t.chance}% of picks · {t.total} arcanes · {t.avg != null ? `average ≈ ${fmt(t.avg)}` : "no prices yet"}</span>
                      </p>
                      <ul className="mt-1.5 grid gap-x-4 gap-y-0.5 font-mono text-xs sm:grid-cols-2">
                        {t.arcanes.map((a) => (
                          <li key={a.slug} className="flex items-baseline justify-between gap-2">
                            <Link href={`/arcanes/${a.slug}`} className="truncate font-sans text-ink hover:text-teal">{names[a.slug] ?? a.slug}{a.basis === "thin" && <span className="ml-1.5 text-xs text-orange" title="Few listings and no max-rank price to cross-check, so this price is shaky">thin</span>}{a.basis === "derived" && <span className="ml-1.5 text-xs text-teal" title="Too few rank-0 listings, so priced as the max-rank price ÷ the copies a max-rank arcane takes">÷</span>}</Link>
                            <span className="shrink-0 text-dim">{a.avg5 != null ? <><span className="text-plat">{fmt(a.avg5)}</span> · {a.share > 0 ? `${(a.share * 100).toFixed(0)}% of value` : ""}</> : "no listings"}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
