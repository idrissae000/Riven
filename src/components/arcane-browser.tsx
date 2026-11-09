"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { rarityClass } from "@/lib/arcanes/style";

export interface ArcaneListItem {
  slug: string; name: string; slot: string; rarity: string | null; description: string;
  categories: string[]; ability_scaling: boolean; scales_with: string[];
}

const CATS: [string, string][] = [["abilities", "Abilities"], ["weapons", "Weapons"], ["melee", "Melee"], ["survivability", "Survivability"], ["movement", "Movement"]];

export function ArcaneBrowser({ items }: { items: ArcaneListItem[] }) {
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState("");
  const [cat, setCat] = useState("");
  const slots = useMemo(() => [...new Set(items.map((i) => i.slot))].sort(), [items]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) =>
      (!slot || i.slot === slot) && (!cat || i.categories.includes(cat)) &&
      (!needle || i.name.toLowerCase().includes(needle) || i.description.toLowerCase().includes(needle) || i.scales_with.some((s) => s.toLowerCase().includes(needle))));
  }, [items, q, slot, cat]);

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <input className="input" type="search" placeholder="Search name, effect or stat (e.g. “ability strength”)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <select className="input" value={slot} onChange={(e) => setSlot(e.target.value)} aria-label="Slot">
            <option value="">All slots</option>
            {slots.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Scales with">
            <option value="">Any scaling</option>
            {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <p className="text-xs text-dim">{shown.length} of {items.length} arcanes</p>
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
            </Link>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="card text-center text-dim">No arcanes match.</p>}
    </div>
  );
}
