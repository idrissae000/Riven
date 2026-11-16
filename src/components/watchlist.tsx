"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plat } from "@/components/brand";
import { Change, LiquidityBadge, Spark } from "@/components/portfolio";
import type { Liquidity } from "@/lib/portfolio/metrics";

export interface WatchRow { slug: string; name: string; kind: "prime" | "arcane"; price: number | null; listings: number; change7d: number | null; liquidity: Liquidity; perDay: number | null; spark: { label: string; v: number }[] }
export interface WatchOption { slug: string; name: string; kind: "prime" | "arcane" }

/** Items you're keeping an eye on: price, 7-day move, how fast they sell. Add anything from the Prime parts or arcane lists. */
export function Watchlist({ rows, options }: { rows: WatchRow[]; options: WatchOption[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const o = options.find((x) => x.name.toLowerCase() === q.trim().toLowerCase());
    if (!o) return setMsg("Pick an item from the suggestions.");
    setBusy(true); setMsg(null);
    const res = await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(json.error ?? "Couldn’t add it.");
    setQ(""); router.refresh();
  }
  async function remove(slug: string) {
    setBusy(true);
    await fetch(`/api/watchlist?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
    setBusy(false); router.refresh();
  }

  return (
    <section className="card space-y-3">
      <h2 className="kicker">Watchlist</h2>
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input className="input min-w-0 flex-1" list="watch-options" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a Prime part, set or arcane…" autoComplete="off" aria-label="Item to watch" />
        <datalist id="watch-options">{options.map((o) => <option key={o.slug} value={o.name} />)}</datalist>
        <button className="btn-primary" disabled={busy}>Watch</button>
      </form>
      {msg && <p role="status" className="text-sm text-ink">{msg}</p>}
      {rows.length === 0 ? <p className="text-sm text-dim">Nothing yet. Add the things you’re waiting to sell or buy and see their price and how fast they move at a glance.</p> : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.slug} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
              <div className="min-w-0"><p className="truncate text-sm text-ink">{r.name}</p><p className="text-xs text-dim">{r.kind === "arcane" ? "Arcane (rank 0)" : "Prime"}{r.listings > 0 && r.listings < 3 ? " · thin market" : ""}</p></div>
              <div className="flex items-center gap-3">
                <Spark points={r.spark} />
                <Change pct={r.change7d} />
                <LiquidityBadge liquidity={r.liquidity} perDay={r.perDay} />
                <span className="h-display flex min-w-14 items-center justify-end gap-1 text-lg text-plat">{r.price != null ? r.price : "—"}{r.price != null && <Plat size={13} />}</span>
                <button className="text-xs text-dim hover:text-danger" disabled={busy} onClick={() => remove(r.slug)} aria-label={`Stop watching ${r.name}`}>remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
