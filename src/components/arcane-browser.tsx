"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { rarityText } from "@/lib/arcanes/style";
import { Plat } from "@/components/brand";
import { About } from "@/components/about";
import { Filters } from "@/components/filters";
import { TrendBadge } from "@/components/trend";
import type { Trend } from "@/lib/history";

import type { ArcanePriceView } from "@/lib/arcanes/price-view";
export type ArcaneListPrice = ArcanePriceView;
export interface ArcaneListItem {
  slug: string; name: string; slot: string; rarity: string | null; description: string;
  categories: string[]; ability_scaling: boolean; scales_with: string[];
  /** Unranked market price (average of the 5 cheapest rank-0 listings, or cheapest max-rank listing ÷ copies when there are fewer than 5); null until the first fetch lands. */
  price: ArcaneListPrice | null;
  /** Where to get it, e.g. "Buy: The Quills". */
  source: string | null;
  /** Price movement over the last week; null until we have two days of history. */
  trend: Trend | null;
}

type Sort = "price-desc" | "price-asc" | "rising" | "falling" | "volume" | "name" | "rarity";
const RARITY_ORDER: Record<string, number> = { Legendary: 0, Rare: 1, Uncommon: 2, Common: 3 };
const SORTS: [Sort, string][] = [["price-desc", "Price: high to low"], ["price-asc", "Price: low to high"], ["rising", "Rising fastest"], ["falling", "Falling fastest"], ["volume", "Most sold (48h)"], ["name", "Name"], ["rarity", "Rarity"]];

function compare(sort: Sort): (a: ArcaneListItem, b: ArcaneListItem) => number {
  const price = (x: ArcaneListItem) => x.price?.price ?? null;
  const nullsLast = (x: number | null, y: number | null, dir: 1 | -1) => (x == null && y == null ? 0 : x == null ? 1 : y == null ? -1 : (x - y) * dir);
  switch (sort) {
    case "price-desc": return (a, b) => nullsLast(price(a), price(b), -1) || a.name.localeCompare(b.name);
    case "price-asc": return (a, b) => nullsLast(price(a), price(b), 1) || a.name.localeCompare(b.name);
    case "rising": return (a, b) => nullsLast(a.trend?.changePct ?? null, b.trend?.changePct ?? null, -1) || a.name.localeCompare(b.name);
    case "falling": return (a, b) => nullsLast(a.trend?.changePct ?? null, b.trend?.changePct ?? null, 1) || a.name.localeCompare(b.name);
    case "volume": return (a, b) => nullsLast(a.price?.volume48h ?? null, b.price?.volume48h ?? null, -1) || a.name.localeCompare(b.name);
    case "rarity": return (a, b) => (RARITY_ORDER[a.rarity ?? ""] ?? 9) - (RARITY_ORDER[b.rarity ?? ""] ?? 9) || a.name.localeCompare(b.name);
    default: return (a, b) => a.name.localeCompare(b.name);
  }
}

function PriceBlock({ price }: { price: ArcaneListPrice | null }) {
  if (!price || (!price.fetched && price.price == null)) return <span className="text-sm text-dim">pricing…</span>;
  if (price.price == null) return <span className="text-sm text-dim">no listings</span>;
  const shown = Number.isInteger(price.price) ? String(price.price) : price.price.toFixed(1);
  const sales = price.volume48h == null ? null : price.volume48h === 0 ? "no sales in 48h" : `${price.volume48h} sold in 48h`;
  return (
    <div className="shrink-0 text-right" title={price.note ?? "Average of the 5 cheapest online rank-0 listings"}>
      <p className="h-display flex items-center justify-end gap-1.5 text-2xl text-plat">{shown} <Plat size={18} /></p>
      <p className="text-xs text-dim">
        {price.basis === "derived" ? <span className="text-teal">from max rank ÷ copies</span> : price.basis === "thin" ? <span className="text-orange">thin market</span> : `low ${price.low}`}
        {sales && <> · {sales}</>}
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
        (!slot || i.slot === slot) && (!cat || i.categories.includes(cat)) && (!solid || (i.price != null && i.price.basis !== "thin" && i.price.basis !== "none")) &&
        (!needle || i.name.toLowerCase().includes(needle) || i.description.toLowerCase().includes(needle) || i.scales_with.some((s) => s.toLowerCase().includes(needle))))
      .sort(compare(sort));
  }, [items, q, slot, cat, sort, solid]);

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <input className="input" type="search" placeholder="Search name or effect…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Filters active={(slot ? 1 : 0) + (cat ? 1 : 0) + (solid ? 1 : 0) + (sort !== "price-desc" ? 1 : 0)}>
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
            Hide thin markets (fewer than 5 listings and no max-rank listing to work from)
          </label>
        </Filters>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-dim">{shown.length} of {items.length} arcanes</p>
          <About>Price = the average of the 5 cheapest online rank-0 listings. If there are fewer than 5, it’s the cheapest max-rank listing ÷ the copies a max-rank arcane is made of (21 for rank 5, 10 for rank 3). Asking prices, not sales.</About>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((a) => (
          <li key={a.slug}>
            <Link href={`/arcanes/${a.slug}`} className="tile block h-full">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold uppercase leading-tight tracking-wide">{a.name}</h2>
                  <p className="mt-0.5 text-sm"><span className={rarityText(a.rarity)}>{a.rarity ?? "—"}</span><span className="text-dim"> · {a.slot}</span></p>
                </div>
                <PriceBlock price={a.price} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-snug text-dim">{a.description.replace(/\n/g, " ")}</p>
              {(a.source || a.trend) && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-dim">
                  <span>{a.source}</span>
                  <TrendBadge trend={a.trend} />
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="card text-center text-dim">No arcanes match.</p>}
    </div>
  );
}
