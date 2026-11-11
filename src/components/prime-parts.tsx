"use client";

import { useMemo, useState } from "react";
import { Plat } from "@/components/brand";
import { About } from "@/components/about";
import { Filters } from "@/components/filters";
import type { PartType } from "@/lib/primes/types";

export interface PartRow {
  slug: string; name: string; kind: "part" | "set"; type: PartType; ducats: number | null; vaulted: boolean | null; relicCount: number;
  /** Average of the 5 cheapest online sell listings; null until priced / when there are none. */
  price: number | null; low: number | null; listings: number; fetched: boolean;
}

type Sort = "price" | "ducats" | "ratio" | "name";
const SORTS: [Sort, string][] = [["price", "Price: high to low"], ["ducats", "Most ducats"], ["ratio", "Best ducats per platinum"], ["name", "Name"]];
const TYPES: [PartType | "", string][] = [["", "All types"], ["warframe", "Warframes"], ["primary", "Primary"], ["secondary", "Secondary"], ["melee", "Melee"], ["archwing", "Archwing"], ["companion", "Companions"]];
const PAGE = 60;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Prime parts and sets ranked by what they cost on Warframe Market. */
export function PrimeParts({ rows }: { rows: PartRow[] }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"" | "part" | "set">("");
  const [type, setType] = useState<PartType | "">("");
  const [vault, setVault] = useState<"" | "vaulted" | "unvaulted" | "other">("");
  const [sort, setSort] = useState<Sort>("price");
  const [shown, setShown] = useState(PAGE);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const ratio = (r: PartRow) => (r.ducats != null && r.price ? r.ducats / r.price : null);
    const key = (r: PartRow): number | null => (sort === "price" ? r.price : sort === "ducats" ? r.ducats : sort === "ratio" ? ratio(r) : null);
    return rows
      .filter((r) =>
        (!kind || r.kind === kind) && (!type || r.type === type) && (!needle || r.name.toLowerCase().includes(needle)) &&
        (!vault || (vault === "vaulted" ? r.vaulted === true : vault === "unvaulted" ? r.vaulted === false : r.vaulted === null && r.kind === "part")))
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        const x = key(a), y = key(b);
        return (x == null ? 1 : y == null ? -1 : y - x) || a.name.localeCompare(b.name);
      });
  }, [rows, q, kind, type, vault, sort]);

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setShown(PAGE); };

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <input className="input" type="search" placeholder="Search a part or set…" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
        <Filters active={(kind ? 1 : 0) + (type ? 1 : 0) + (vault ? 1 : 0) + (sort !== "price" ? 1 : 0)}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <select className="input" value={sort} onChange={(e) => reset(setSort)(e.target.value as Sort)} aria-label="Sort by">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select className="input" value={kind} onChange={(e) => reset(setKind)(e.target.value as "" | "part" | "set")} aria-label="Parts or sets">
            <option value="">Parts and sets</option><option value="part">Parts only</option><option value="set">Sets only</option>
          </select>
          <select className="input" value={type} onChange={(e) => reset(setType)(e.target.value as PartType | "")} aria-label="Type">{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select className="input" value={vault} onChange={(e) => reset(setVault)(e.target.value as "" | "vaulted" | "unvaulted" | "other")} aria-label="Vault status">
            <option value="">Any vault status</option><option value="vaulted">Vaulted</option><option value="unvaulted">In the drop tables</option><option value="other">Not a relic drop (Baro, exclusives)</option>
          </select>
        </div>
        </Filters>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-dim">{list.length} of {rows.length}</p>
          <About>Price = average of the 5 cheapest online sell listings (asking prices, not sales). “Vaulted” means every relic that drops the part is vaulted.</About>
        </div>
      </div>

      <ol className="grid gap-2 sm:grid-cols-2">
        {list.slice(0, shown).map((r, i) => (
          <li key={r.slug} className="tile flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-base font-semibold leading-snug"><span className="mr-2 font-mono text-sm font-normal text-dim">{i + 1}</span>{r.name}</p>
              <p className="mt-0.5 text-sm text-dim">
                {r.kind === "set" ? "Set" : r.type[0].toUpperCase() + r.type.slice(1)}
                {r.vaulted === true && <> · <span className="font-semibold text-orange">vaulted</span></>}
                {r.vaulted === false && <> · <span className="font-semibold text-teal">farmable</span></>}
                {r.vaulted === null && r.kind === "part" && <> · not a relic drop</>}
                {r.ducats != null && <> · {r.ducats} ducats</>}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {r.price != null ? (
                <>
                  <p className="h-display flex items-center justify-end gap-1.5 text-xl text-plat">{fmt(r.price)} <Plat size={16} /></p>
                  <p className="text-xs text-dim">low {r.low}{r.listings < 3 ? " · thin market" : ""}</p>
                </>
              ) : <span className="text-xs text-dim">{r.fetched ? "no online listings" : "pricing…"}</span>}
            </div>
          </li>
        ))}
      </ol>
      {list.length > shown && <button className="btn w-full" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, list.length - shown)} more</button>}
      {list.length === 0 && <p className="card text-center text-dim">Nothing matches.</p>}
    </div>
  );
}
