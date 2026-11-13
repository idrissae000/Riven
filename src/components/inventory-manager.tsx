"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plat } from "@/components/brand";
import type { SetDef } from "@/lib/primes/combine-sets";
import { ListOnMarket, sellKey, type SellRow } from "@/components/list-on-market";
import { InventoryFilter } from "@/components/inventory-filter";
import { browseRows, type InvSort } from "@/lib/inventory/browse";
import type { SetAdvice, ValuedRow } from "@/lib/inventory/value";

export interface AddOption { slug: string; kind: "prime" | "arcane"; name: string; maxRank: number | null }

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Add what you own, see what it's worth, and what's best to sell. */
export function InventoryManager({ options, rows, total, priced, advice, sets, setPrices }: { options: AddOption[]; rows: ValuedRow[]; total: number; priced: number; advice: SetAdvice[]; sets: SetDef[]; setPrices: Record<string, number> }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [qty, setQty] = useState(1);
  const [maxRank, setMaxRank] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listAll, setListAll] = useState(false);
  const [listOne, setListOne] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<InvSort>("total");
  const [error, setError] = useState<string | null>(null);

  const byName = new Map(options.map((o) => [o.name.toLowerCase(), o]));
  const chosen = byName.get(text.trim().toLowerCase());

  async function call(url: string, init: RequestInit) {
    setBusy(true); setError(null);
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Something went wrong"); return false; }
    router.refresh();
    return true;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen) return setError("Pick an item from the list.");
    const ok = await call("/api/inventory", { method: "POST", body: JSON.stringify({ kind: chosen.kind, slug: chosen.slug, rank: chosen.kind === "arcane" && maxRank ? chosen.maxRank : 0, qty }) });
    if (ok) { setText(""); setQty(1); setMaxRank(false); }
  }

  async function clearAll() {
    if (!confirm(`Remove all ${rows.length} items from your saved inventory? This can’t be undone.`)) return;
    await call("/api/inventory", { method: "DELETE" });
  }

  const shownRows = browseRows(rows, q, sort);
  const sellRow = (r: ValuedRow): SellRow => ({ key: sellKey(r.kind, r.slug, r.rank), kind: r.kind, slug: r.slug, rank: r.rank, name: r.rank > 0 ? `${r.name} (max rank)` : r.name, qty: r.qty, unit: r.unit, ducats: r.ducatsTotal != null ? r.ducatsTotal / r.qty : null });
  const allSellRows = rows.map(sellRow);
  const sells = rows.filter((r) => r.total != null).slice(0, 5);

  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <div>
          <p className="kicker">Inventory worth</p>
          <p className="h-display flex items-center gap-2 text-4xl text-plat">{priced ? <>≈ {fmt(total)} <Plat size={26} /></> : <span className="text-dim">—</span>}</p>
          <p className="mt-1 text-xs text-dim">{priced} of {rows.length} items priced · market asking prices (average of the 5 cheapest online listings)</p>
        </div>
        {rows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => { setListOne(null); setListAll(true); }}>List everything on Warframe Market</button>
            <button className="btn-danger" onClick={clearAll} disabled={busy}>Clear all</button>
          </div>
        )}
      </section>

      {listAll && <ListOnMarket sets={sets} setPrices={setPrices} rows={allSellRows} title="List your inventory on Warframe Market" onClose={() => setListAll(false)} />}

      <form onSubmit={add} className="card space-y-3">
        <h2 className="kicker">Add to your inventory</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
          <div>
            <label className="label" htmlFor="inv-item">Prime part, set or arcane</label>
            <input id="inv-item" className="input" list="inv-options" value={text} onChange={(e) => setText(e.target.value)} placeholder="Start typing… e.g. Frost Prime Chassis" autoComplete="off" />
            <datalist id="inv-options">{options.map((o) => <option key={`${o.kind}:${o.slug}`} value={o.name} />)}</datalist>
          </div>
          <div>
            <label className="label" htmlFor="inv-qty">Quantity</label>
            <input id="inv-qty" className="input" type="number" min={1} max={9999} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
          </div>
        </div>
        {chosen?.kind === "arcane" && chosen.maxRank != null && (
          <label className="flex items-center gap-2 text-sm text-dim"><input type="checkbox" checked={maxRank} onChange={(e) => setMaxRank(e.target.checked)} /> These are max rank ({chosen.maxRank})</label>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? "Adding…" : "Add"}</button>
      </form>

      {(sells.length > 0 || advice.length > 0) && (
        <section className="card space-y-3">
          <h2 className="kicker">What to sell</h2>
          {advice.length > 0 && (
            <ul className="space-y-2 text-sm">
              {advice.map((a) => (
                <li key={a.setSlug} className="rounded-lg border border-line bg-void/40 p-3">
                  {a.kind === "complete" ? (
                    <>
                      <p><b>{a.name}</b> — you can make {a.count}. {a.gain > 0
                        ? <>Sell it as a set: <span className="text-plat">{fmt(a.setPrice * a.count)}p</span> vs {fmt(a.partsValue)}p as loose parts (<b className="text-ok">+{fmt(a.gain)}p</b>).</>
                        : <>The parts sell for more separately: {fmt(a.partsValue)}p vs {fmt(a.setPrice * a.count)}p as a set.</>}</p>
                    </>
                  ) : (
                    <p><b>{a.name}</b> — one part short. Buy {a.missing[0].qty}× {a.missing[0].name} (~{fmt(a.missingCost)}p), then sell the set for <span className="text-plat">{fmt(a.setPrice)}p</span> instead of {fmt(a.partsValue)}p for the parts you hold (<b className="text-ok">+{fmt(a.gain)}p</b>).</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {sells.length > 0 && (
            <div>
              <p className="label">Your most valuable stacks</p>
              <ol className="space-y-1 text-sm">
                {sells.map((r) => (
                  <li key={r.id} className="flex items-baseline justify-between gap-3">
                    <span className="truncate">{r.qty}× {r.name}{r.kind === "arcane" && r.rank > 0 ? " (max rank)" : ""}</span>
                    <span className="shrink-0 font-mono text-plat">{fmt(r.total as number)}p</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="kicker">Your items</h2>
        {rows.length === 0 && <p className="card text-center text-dim">Nothing here yet. Add the Prime parts and arcanes you own above.</p>}
        {rows.length > 1 && <InventoryFilter q={q} onQ={setQ} sort={sort} onSort={setSort} shown={shownRows.length} total={rows.length} />}
        <ul className="space-y-2">
          {shownRows.map((r) => (
            <li key={r.id} className="tile flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-[0.95rem] font-semibold">{r.name}{r.kind === "arcane" && <span className="ml-2 text-xs font-normal text-dim">{r.rank > 0 ? "max rank" : "unranked"}</span>}</p>
                <p className="mt-0.5 font-mono text-xs text-dim">
                  {r.unit != null ? `${fmt(r.unit)}p each` : "no price yet"}
                  {r.ducatsTotal != null && ` · ${r.ducatsTotal} ducats${r.ducatsPerPlat ? ` (${r.ducatsPerPlat}/p)` : ""}`}
                  {r.note && ` · ${r.note}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center">
                  <button className="btn min-h-9 w-9 px-0" aria-label="One fewer" disabled={busy || r.qty <= 1} onClick={() => call(`/api/inventory/${r.id}`, { method: "PATCH", body: JSON.stringify({ qty: r.qty - 1 }) })}>−</button>
                  <span className="w-10 text-center font-mono">{r.qty}</span>
                  <button className="btn min-h-9 w-9 px-0" aria-label="One more" disabled={busy || r.qty >= 9999} onClick={() => call(`/api/inventory/${r.id}`, { method: "PATCH", body: JSON.stringify({ qty: r.qty + 1 }) })}>+</button>
                </div>
                <p className="h-display flex w-20 items-center justify-end gap-1 text-lg text-plat">{r.total != null ? <>{fmt(r.total)} <Plat size={14} /></> : <span className="text-sm text-dim">—</span>}</p>
                <button className="btn min-h-9 px-3 text-xs" onClick={() => setListOne((id) => (id === r.id ? null : r.id))} aria-expanded={listOne === r.id}>List</button>
                <button className="text-xs text-dim hover:text-danger" disabled={busy} onClick={() => call(`/api/inventory/${r.id}`, { method: "DELETE" })} aria-label={`Remove ${r.name}`}>remove</button>
              </div>
              {listOne === r.id && <div className="basis-full"><ListOnMarket rows={[sellRow(r)]} title={`List ${r.name} on Warframe Market`} onClose={() => setListOne(null)} /></div>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
