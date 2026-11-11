"use client";

import { useMemo, useState } from "react";
import { Plat } from "@/components/brand";
import { About } from "@/components/about";
import { Filters } from "@/components/filters";

export interface WeaponRow {
  slug: string; name: string; type: string; group: string | null;
  listings: number; saturated: boolean; low: number | null; median: number | null; p75: number | null;
  /** Stats whose listings ask more, with the typical price with / without them. */
  stats: { name: string; withMedian: number; withoutMedian: number; n: number }[];
  fetched: boolean;
}

type Sort = "median" | "p75" | "low" | "supply" | "name";
const SORTS: [Sort, string][] = [["median", "Typical asking price (high to low)"], ["p75", "Upper-quartile price"], ["low", "Cheapest listing"], ["supply", "Most listings"], ["name", "Name"]];
const TYPES = ["", "rifle", "shotgun", "pistol", "melee", "archgun", "kitgun", "zaw"];
const PAGE = 60;

/** Weapons ranked by what their rivens ask on Warframe Market. */
export function WeaponRanking({ rows }: { rows: WeaponRow[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState<Sort>("median");
  const [solid, setSolid] = useState(true);
  const [shown, setShown] = useState(PAGE);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const key = (r: WeaponRow): number | null => (sort === "median" ? r.median : sort === "p75" ? r.p75 : sort === "low" ? r.low : sort === "supply" ? r.listings : null);
    return rows
      .filter((r) => (!type || r.type === type) && (!needle || r.name.toLowerCase().includes(needle)) && (!solid || r.listings >= 8))
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        const x = key(a), y = key(b);
        return (x == null ? 1 : y == null ? -1 : y - x) || a.name.localeCompare(b.name);
      });
  }, [rows, q, type, sort, solid]);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setShown(PAGE); };

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <input className="input" type="search" placeholder="Search a weapon…" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
        <Filters active={(sort !== "median" ? 1 : 0) + (type ? 1 : 0) + (!solid ? 1 : 0)}>
        <div className="grid grid-cols-2 gap-3">
          <select className="input" value={sort} onChange={(e) => reset(setSort)(e.target.value as Sort)} aria-label="Sort by">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select className="input" value={type} onChange={(e) => reset(setType)(e.target.value)} aria-label="Weapon type">{TYPES.map((t) => <option key={t} value={t}>{t ? t[0].toUpperCase() + t.slice(1) : "All weapon types"}</option>)}</select>
        </div>
        <label className="flex items-center gap-2 text-xs text-dim">
          <input type="checkbox" checked={solid} onChange={(e) => reset(setSolid)(e.target.checked)} />
          Hide weapons with fewer than 8 live riven listings (a few listings can’t tell you what a riven for it really asks)
        </label>
        </Filters>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-dim">{list.length} weapons</p>
          <About>“Typical” is the median asking price among the cheapest buy-it-now rivens for that weapon (Warframe Market shows up to 99 per weapon, cheapest first), so for popular weapons it describes the low end of the market. These are asking prices, not sales — Warframe Market publishes no riven sales data.</About>
        </div>
      </div>

      <ol className="grid gap-2 sm:grid-cols-2">
        {list.slice(0, shown).map((r, i) => (
          <li key={r.slug} className="card !py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-[0.95rem] font-semibold"><span className="mr-2 font-mono text-xs text-dim">{i + 1}</span>{r.name}</p>
                <p className="mt-0.5 flex flex-wrap gap-1.5 text-xs"><span className="chip">{r.type}</span><span className="chip">{r.saturated ? "99+" : r.listings} listed</span></p>
              </div>
              <div className="shrink-0 text-right">
                {r.median != null ? (
                  <>
                    <p className="h-display flex items-center justify-end gap-1.5 text-xl text-plat">{r.median} <Plat size={16} /></p>
                    <p className="font-mono text-[0.65rem] text-dim">low {r.low} · top quarter {r.p75}+</p>
                  </>
                ) : <span className="text-xs text-dim">{r.fetched ? "no listings" : "pricing…"}</span>}
              </div>
            </div>
            {r.stats.length > 0 && (
              <p className="mt-2 text-xs text-dim">
                Stats that ask more:{" "}
                {r.stats.map((s, k) => <span key={s.name}>{k ? ", " : ""}<b className="text-ink">{s.name}</b> <span className="font-mono">({s.withMedian}p vs {s.withoutMedian}p)</span></span>)}
              </p>
            )}
          </li>
        ))}
      </ol>
      {list.length > shown && <button className="btn w-full" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, list.length - shown)} more</button>}
      {list.length === 0 && <p className="card text-center text-dim">{rows.some((r) => r.fetched) ? "No weapons match." : "Pricing weapons… this fills in over the next few minutes."}</p>}
    </div>
  );
}
