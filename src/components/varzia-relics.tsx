"use client";

import { useState } from "react";
import { Plat } from "@/components/brand";

export interface PoolRow { name: string; ev: number; best: { name: string; price: number } | null; unpriced: number }
export interface PackRow {
  name: string; era: string; vault: string; colour: string; refinement: string;
  /** What it costs in Aya. */
  aya: number | null;
  pool: PoolRow[]; avg: number | null;
}
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Varzia's relic packs, ranked by what the average relic in the pack's pool is worth per Aya. */
export function VarziaRelics({ packs, others }: { packs: PackRow[]; others: { name: string; cost: string }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const ranked = packs.map((p) => ({ ...p, perAya: p.avg != null && p.aya ? Math.round((p.avg / p.aya) * 10) / 10 : null })).sort((a, b) => (b.perAya ?? -1) - (a.perAya ?? -1));
  const best = ranked.find((p) => p.perAya != null);

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Glance label="Relic packs" value={String(packs.length)} sub="for sale right now" />
        <Glance label="Best per Aya" value={best ? `${best.era} (Vault ${best.vault})` : "—"} sub={best?.perAya != null ? `≈ ${fmt(best.perAya)}p per Aya (${best.colour})` : "no prices yet"} small />
        <Glance label="Relics in the pools" value={String(new Set(packs.flatMap((p) => p.pool.map((r) => r.name))).size)} sub="all vaulted, so only Varzia has them" />
      </section>

      <section className="card space-y-1 text-xs text-dim">
        <p>Each pack’s value is the <b className="text-ink">average</b> of what every relic in its pool is worth, valued at the pack’s refinement ({[...new Set(packs.map((p) => p.colour))].join(", ")} = {[...new Set(packs.map((p) => p.refinement))].join(", ")}). A relic is worth the platinum of what it can open to: each reward’s drop chance × its current price (the average of the 5 cheapest online listings, parts with fewer than 3 sellers not counted, Forma counted as nothing).</p>
        <p>The pool is every relic of that era that drops a part of the vault’s Primes. The game’s feed doesn’t say which relics sit in “Vault A” and which in “Vault B”, or how many relics a pack gives, so every pack is valued as <b className="text-ink">one relic drawn from the whole era’s pool</b>. Open a pack to see the relics in it, best first. Relics that finish unpriced make a pool’s value a floor.</p>
      </section>

      <ul className="space-y-3">
        {ranked.map((p) => {
          const isOpen = open === p.name;
          return (
            <li key={p.name} className="tile space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold leading-tight">{p.era} relic pack · Vault {p.vault}</h3>
                  <p className="mt-0.5 text-sm text-dim">{p.colour} ({p.refinement}) · {p.aya != null ? `${p.aya} Aya` : "—"} · {p.pool.length} relics in the pool</p>
                </div>
                {p.perAya != null && <p className="h-display text-xl normal-case text-teal">{fmt(p.perAya)}p <span className="text-sm font-normal text-dim">per Aya</span></p>}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <Stat label="Average relic" value={p.avg != null ? `${fmt(p.avg)}p` : "—"} />
                <Stat label="Best relic" value={p.pool[0] ? `${fmt(p.pool[0].ev)}p` : "—"} sub={p.pool[0]?.name} />
                <Stat label="Worst relic" value={p.pool.length ? `${fmt(p.pool[p.pool.length - 1].ev)}p` : "—"} sub={p.pool[p.pool.length - 1]?.name} />
              </div>
              <button className="btn min-h-8 px-3 text-xs" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.name)}>{isOpen ? "Hide relics" : "Show the relics"}</button>
              {isOpen && (
                <ul className="divide-y divide-line text-sm">
                  {p.pool.map((r) => (
                    <li key={r.name} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-1.5">
                      <span className="text-ink">{r.name}{r.unpriced > 0 ? <span className="text-xs text-dim"> · {r.unpriced} part{r.unpriced === 1 ? "" : "s"} unpriced</span> : null}</span>
                      <span className="flex items-center gap-3 text-xs text-dim">{r.best ? <span>top: {r.best.name.replace(/ Blueprint$/, "")} ({fmt(r.best.price)}p)</span> : null}<b className="inline-flex items-center gap-0.5 text-plat">{fmt(r.ev)}<Plat size={11} /></b></span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        {ranked.length === 0 && <li className="card text-sm text-dim">She isn’t selling any relic packs right now.</li>}
      </ul>

      {others.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm text-dim">Everything else she’s selling ({others.length}) — Prime sets, cosmetics, packs</summary>
          <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {others.map((r) => <li key={r.name} className="flex justify-between gap-3"><span className="truncate text-ink">{r.name}</span><span className="shrink-0 text-dim">{r.cost}</span></li>)}
          </ul>
        </details>
      )}
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
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div><p className="text-xs text-dim">{label}</p><p className="h-display text-xl normal-case text-ink">{value}</p>{sub && <p className="text-xs text-dim">{sub}</p>}</div>;
}
