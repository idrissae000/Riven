"use client";

import { useMemo, useState } from "react";
import { About } from "@/components/about";
import { Plat } from "@/components/brand";
import { Segmented } from "@/components/segmented";
import type { Flip } from "@/lib/primes/flips";

type Sort = "profit" | "roi";
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const PAGE = 30;
/** "Frost Prime Chassis Blueprint" in "Frost Prime Set" -> "Chassis Blueprint". */
const shortPart = (part: string, set: string) => { const prefix = set.replace(/ Set$/, "") + " "; return part.startsWith(prefix) ? part.slice(prefix.length) : part; };

/** Prime sets that sell for more than their parts cost: buy the parts, assemble, sell the set. */
export function FlipList({ flips }: { flips: Flip[] }) {
  const [sort, setSort] = useState<Sort>("profit");
  const [solid, setSolid] = useState(true);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return flips
      .filter((f) => (!solid || !f.thin) && (!needle || f.name.toLowerCase().includes(needle)))
      .sort((a, b) => (sort === "roi" ? b.roi - a.roi : b.profit - a.profit) || a.name.localeCompare(b.name));
  }, [flips, sort, solid, q]);

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <input className="input" type="search" placeholder="Search a set…" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented<Sort> label="Sort by" value={sort} onChange={setSort} options={[{ value: "profit", label: "Most platinum" }, { value: "roi", label: "Best return" }]} />
          <label className="flex items-center gap-2 text-sm text-dim"><input type="checkbox" checked={solid} onChange={(e) => { setSolid(e.target.checked); setShown(PAGE); }} /> Hide thin markets</label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-dim">{list.length} flips</p>
          <About>Buy every part, assemble the set, sell it. Profit = set price − what all the parts cost (a part the set needs twice is counted twice). These are asking prices — a part’s cheapest listing may already be gone, and prices move, so check the market before buying. “Thin” = fewer than 3 listings behind a price.</About>
        </div>
      </div>

      <ol className="space-y-2">
        {list.slice(0, shown).map((f, i) => (
          <li key={f.setSlug} className="tile space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-display text-base font-semibold"><span className="mr-2 font-mono text-sm font-normal text-dim">{i + 1}</span>{f.name}{f.thin && <span className="ml-2 text-xs font-normal text-orange">thin market</span>}</p>
              <p className="h-display flex items-center gap-1.5 text-xl text-ok">+{fmt(f.profit)} <Plat size={16} /> <span className="text-sm font-normal text-dim">({f.roi}%)</span></p>
            </div>
            <p className="text-sm text-dim">
              Sells for <span className="text-plat">{fmt(f.setPrice)}p</span> · parts cost <span className="text-plat">{fmt(f.partsCost)}p</span>
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-dim">
              {f.parts.map((p) => <li key={p.slug}>{p.qty > 1 && `${p.qty}× `}{shortPart(p.name, f.name)} <span className="text-plat">{fmt(p.price)}p</span></li>)}
            </ul>
          </li>
        ))}
      </ol>
      {list.length > shown && <button className="btn w-full" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, list.length - shown)} more</button>}
      {list.length === 0 && <p className="card text-center text-dim">{flips.length ? "Nothing matches." : "No profitable flips right now — or prices are still loading."}</p>}
    </div>
  );
}
