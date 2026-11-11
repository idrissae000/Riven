"use client";

import { useMemo, useState } from "react";
import { Plat } from "@/components/brand";
import { About } from "@/components/about";
import { Filters } from "@/components/filters";
import { REFINEMENTS, type RefinementId } from "@/lib/primes/relic-value";

export interface RelicRow {
  id: string; name: string; era: string; vaulted: boolean;
  /** Expected platinum per run, in REFINEMENTS order (intact, exceptional, flawless, radiant). */
  ev: number[];
  unpriced: number;
  drops: { slug: string | null; rarity: "common" | "uncommon" | "rare"; price: number | null }[];
}

const PAGE = 40;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const ERAS = ["Lith", "Meso", "Neo", "Axi"];

/** Relics ranked by what one run is worth on average. `names` maps item slug → display name. */
export function RelicTable({ relics, names }: { relics: RelicRow[]; names: Record<string, string> }) {
  const [refine, setRefine] = useState<RefinementId>("radiant");
  const [vault, setVault] = useState<"" | "unvaulted" | "vaulted">("");
  const [era, setEra] = useState("");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const idx = REFINEMENTS.findIndex((r) => r.id === refine);
  const nameOf = (slug: string | null) => (slug == null ? "Forma Blueprint" : names[slug] ?? slug);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return relics
      .filter((r) => (!vault || (vault === "vaulted") === r.vaulted) && (!era || r.era === era) &&
        (!needle || r.name.toLowerCase().includes(needle) || r.drops.some((d) => nameOf(d.slug).toLowerCase().includes(needle))))
      .sort((a, b) => b.ev[idx] - a.ev[idx] || a.name.localeCompare(b.name, "en", { numeric: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relics, vault, era, q, idx, names]);

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setShown(PAGE); };

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <input className="input" type="search" placeholder="Search a relic or part it drops…" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
        <Filters active={(refine !== "radiant" ? 1 : 0) + (era ? 1 : 0) + (vault ? 1 : 0)}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <select className="input" value={refine} onChange={(e) => reset(setRefine)(e.target.value as RefinementId)} aria-label="Refinement">
            {REFINEMENTS.map((r) => <option key={r.id} value={r.id}>{r.label}{r.traces ? ` (${r.traces} traces)` : ""}</option>)}
          </select>
          <select className="input" value={era} onChange={(e) => reset(setEra)(e.target.value)} aria-label="Era"><option value="">All eras</option>{ERAS.map((e) => <option key={e}>{e}</option>)}</select>
          <select className="input" value={vault} onChange={(e) => reset(setVault)(e.target.value as "" | "unvaulted" | "vaulted")} aria-label="Vault status">
            <option value="">Vaulted and not</option><option value="unvaulted">In the drop tables (farmable)</option><option value="vaulted">Vaulted</option>
          </select>
        </div>
        </Filters>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-dim">{list.length} of {relics.length} relics</p>
          <About>Value = the platinum you’d expect from one reward pick, from each drop’s odds at the chosen refinement and its current price (average of the 5 cheapest online listings). Forma Blueprints can’t be traded and count as 0. Prices are asking prices, not sales.</About>
        </div>
      </div>

      <ol className="space-y-2">
        {list.slice(0, shown).map((r, i) => {
          const rare = r.drops[5];
          return (
            <li key={r.id} className="tile">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-[1rem] font-semibold"><span className="mr-2 font-mono text-xs text-dim">{i + 1}</span>{r.name}</p>
                  <p className="mt-0.5 text-sm text-dim">
                    {r.vaulted ? <span className="font-semibold text-orange">Vaulted</span> : <span className="font-semibold text-teal">Farmable</span>}
                    <span className="block sm:inline"><span className="hidden sm:inline"> · </span>Rare drop: {nameOf(rare.slug)}{rare.price != null ? ` (${fmt(rare.price)}p)` : ""}</span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="h-display flex items-center justify-end gap-1.5 text-2xl text-plat">≈ {fmt(r.ev[idx])} <Plat size={18} /></p>
                  <p className="text-xs text-dim">per run · {REFINEMENTS[idx].label.toLowerCase()}{r.unpriced ? " · some drops unpriced" : ""}</p>
                </div>
              </div>
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer font-display text-xs font-semibold uppercase tracking-[0.1em] text-gold hover:text-ink">Drops and odds</summary>
                <ul className="mt-2 space-y-0.5 font-mono">
                  {r.drops.map((d, k) => (
                    <li key={k} className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-sans text-ink">{nameOf(d.slug)} <span className="text-dim">({d.rarity})</span></span>
                      <span className="shrink-0 text-dim">{d.slug == null ? "untradable" : d.price != null ? `${fmt(d.price)}p` : "no listings"}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-mono text-dim">{REFINEMENTS.map((f, k) => `${f.label} ≈ ${fmt(r.ev[k])}`).join(" · ")}</p>
              </details>
            </li>
          );
        })}
      </ol>
      {list.length > shown && <button className="btn w-full" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, list.length - shown)} more</button>}
      {list.length === 0 && <p className="card text-center text-dim">No relics match.</p>}
    </div>
  );
}
