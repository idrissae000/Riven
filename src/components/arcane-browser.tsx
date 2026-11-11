"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { rarityClass } from "@/lib/arcanes/style";
import { Plat } from "@/components/brand";

export interface ArcaneListPrice { avg5: number | null; low: number | null; listings: number; volume48h: number | null; fetched: boolean }
export interface ArcaneListItem {
  slug: string; name: string; slot: string; rarity: string | null; description: string;
  categories: string[]; ability_scaling: boolean; scales_with: string[];
  /** Rank-0 market price (average of the 5 cheapest online listings); null until the first fetch lands. */
  price: ArcaneListPrice | null;
  /** Where to get it, e.g. "Buy: The Quills". */
  source: string | null;
}

type Sort = "price-desc" | "price-asc" | "volume" | "name" | "rarity";
const RARITY_ORDER: Record<string, number> = { Legendary: 0, Rare: 1, Uncommon: 2, Common: 3 };
const SORTS: [Sort, string][] = [["price-desc", "Price: high to low"], ["price-asc", "Price: low to high"], ["volume", "Most sold (48h)"], ["name", "Name"], ["rarity", "Rarity"]];

function compare(sort: Sort): (a: ArcaneListItem, b: ArcaneListItem) => number {
  const price = (x: ArcaneListItem) => x.price?.avg5 ?? null;
  const nullsLast = (x: number | null, y: number | null, dir: 1 | -1) => (x == null && y == null ? 0 : x == null ? 1 : y == null ? -1 : (x - y) * dir);
  switch (sort) {
    case "price-desc": return (a, b) => nullsLast(price(a), price(b), -1) || a.name.localeCompare(b.name);
    case "price-asc": return (a, b) => nullsLast(price(a), price(b), 1) || a.name.localeCompare(b.name);
    case "volume": return (a, b) => nullsLast(a.price?.volume48h ?? null, b.price?.volume48h ?? null, -1) || a.name.localeCompare(b.name);
    case "rarity": return (a, b) => (RARITY_ORDER[a.rarity ?? ""] ?? 9) - (RARITY_ORDER[b.rarity ?? ""] ?? 9) || a.name.localeCompare(b.name);
    default: return (a, b) => a.name.localeCompare(b.name);
  }
}

function PriceBlock({ price }: { price: ArcaneListPrice | null }) {
  if (!price || (!price.fetched && price.avg5 == null)) return <span className="text-xs text-dim">pricing…</span>;
  if (price.avg5 == null) return <span className="text-xs text-dim">no online listings</span>;
  return (
    <div className="text-right" title="Average of the 5 cheapest online rank-0 listings">
      <p className="h-display flex items-center justify-end gap-1.5 text-xl text-plat">≈ {Math.round(price.avg5)} <Plat size={16} /></p>
      <p className="font-mono text-[0.65rem] text-dim">
        low {price.low}{price.listings < 3 ? " · thin market" : ""}{price.volume48h != null ? ` · ${price.volume48h === 0 ? "no sales in 48h" : `${price.volume48h} sold/48h`}` : ""}
      </p>
    </div>
  );
}

const CATS: [string, string][] = [["abilities", "Abilities"], ["weapons", "Weapons"], ["melee", "Melee"], ["survivability", "Survivability"], ["movement", "Movement"]];

export function ArcaneBrowser({ items }: { items: ArcaneListItem[] }) {
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState("");
  const [cat, setCat] = useState("");
  const [sort, setSort] = useState<Sort>("price-desc");
  const [solid, setSolid] = useState(false); // hide thin markets
  const slots = useMemo(() => [...new Set(items.map((i) => i.slot))].sort(), [items]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter((i) =>
        (!slot || i.slot === slot) && (!cat || i.categories.includes(cat)) && (!solid || (i.price?.listings ?? 0) >= 3) &&
        (!needle || i.name.toLowerCase().includes(needle) || i.description.toLowerCase().includes(needle) || i.scales_with.some((s) => s.toLowerCase().includes(needle))))
      .sort(compare(sort));
  }, [items, q, slot, cat, sort, solid]);

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <input className="input" type="search" placeholder="Search name, effect or stat (e.g. “ability strength”)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="input" value={slot} onChange={(e) => setSlot(e.target.value)} aria-label="Slot">
            <option value="">All slots</option>
            {slots.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Scales with">
            <option value="">Any scaling</option>
            {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-dim">
          <input type="checkbox" checked={solid} onChange={(e) => setSolid(e.target.checked)} />
          Hide thin markets (fewer than 3 online listings — one odd ask can set the “price”)
        </label>
        <p className="text-xs text-dim">{shown.length} of {items.length} arcanes · price = average of the 5 cheapest online rank-0 listings (asking prices, not sales)</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((a) => (
          <li key={a.slug}>
            <Link href={`/arcanes/${a.slug}`} className="card block h-full transition hover:border-violet/60">
              <div className="flex items-start justify-between gap-2">
                <span className="h-display text-xl leading-tight">{a.name}</span>
                <span className={`chip shrink-0 ${rarityClass(a.rarity)}`}>{a.rarity ?? "—"}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="chip">{a.slot}</span>
                {a.ability_scaling && <span className="chip border-teal/50 text-teal">ability scaling</span>}
                {a.scales_with.slice(0, 2).map((s) => <span key={s} className="chip">{s}</span>)}
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-dim">{a.description.replace(/\n/g, " ")}</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <span className="min-w-0 truncate text-xs text-dim">{a.source ?? ""}</span>
                <PriceBlock price={a.price} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="card text-center text-dim">No arcanes match.</p>}
    </div>
  );
}
