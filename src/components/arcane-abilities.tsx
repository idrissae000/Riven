"use client";

import { useMemo, useState } from "react";
import type { AbilityList } from "@/lib/wiki/wikitext";

const SHOWN = 12;

/**
 * One list from an arcane's wiki page — the abilities that trigger it (valid) or that don't (invalid).
 * Each entry reads "Tectonics (Atlas)" with a ★ when the ability can be subsumed onto the Helminth,
 * plus the wiki's note for that row ("Only when creating a new Dread Heart.").
 */
export function ArcaneAbilities({ list }: { list: AbilityList }) {
  const [q, setQ] = useState("");
  const [helminthOnly, setHelminthOnly] = useState(false);
  const [all, setAll] = useState(false);
  const valid = list.kind === "valid";
  const filtering = !!q.trim() || helminthOnly;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.abilities.filter((a) => (!helminthOnly || a.helminth) && (!needle || a.name.toLowerCase().includes(needle) || (a.warframe ?? "").toLowerCase().includes(needle) || (a.note ?? "").toLowerCase().includes(needle)));
  }, [list.abilities, q, helminthOnly]);
  const visible = all || filtering ? filtered : filtered.slice(0, SHOWN);

  return (
    <div className="space-y-3">
      <div>
        <h3 className={`font-display text-sm font-bold uppercase tracking-[0.14em] ${valid ? "text-teal" : "text-danger"}`}>
          {valid ? "Works with these abilities" : "Does not work with"} <span className="text-dim">· {list.abilities.length}</span>
        </h3>
        {list.intro && <p className="mt-1 text-xs leading-relaxed text-dim">{list.intro}</p>}
      </div>

      {list.abilities.length > SHOWN && (
        <div className="flex flex-wrap items-center gap-2">
          <input className="input max-w-xs flex-1" type="search" placeholder="Find an ability or Warframe…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search abilities" />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-gold" checked={helminthOnly} onChange={(e) => setHelminthOnly(e.target.checked)} />
            <span><span className="text-gold">★</span> Helminth only</span>
          </label>
        </div>
      )}

      <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {visible.map((a, i) => (
          <li key={`${a.warframe}-${a.name}-${i}`} className="flex items-baseline gap-2">
            <span className={valid ? "text-teal" : "text-danger"} aria-hidden>{valid ? "▸" : "✕"}</span>
            <span>
              {a.name}
              {a.warframe && <span className="text-dim"> ({a.warframe})</span>}
              {a.helminth && <span className="ml-1 text-gold" title="Can be subsumed onto the Helminth">★</span>}
              {a.note && <span className="block text-xs leading-snug text-dim">{a.note}</span>}
            </span>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && <p className="text-sm text-dim">No matching abilities.</p>}

      {!all && !filtering && filtered.length > SHOWN && (
        <button className="btn min-h-9 px-3 text-xs" onClick={() => setAll(true)}>Show all {filtered.length}</button>
      )}
      {list.abilities.some((a) => a.helminth) && <p className="text-xs text-dim"><span className="text-gold">★</span> = can be subsumed onto the Helminth.</p>}
    </div>
  );
}
