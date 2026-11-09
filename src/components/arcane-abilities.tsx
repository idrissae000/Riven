"use client";

import { useMemo, useState } from "react";
import type { AbilityRow } from "@/lib/data";

const SHOWN = 14;

/**
 * The abilities an arcane works with, as "Roar (Rhino)" with a ★ when the ability is Helminth-subsumable.
 * Strength-scaling arcanes apply to ~180 abilities, so this has search + a Helminth-only filter + expand.
 */
export function ArcaneAbilities({ abilities, statLabels, unknownCount }: { abilities: AbilityRow[]; statLabels: string[]; unknownCount: number }) {
  const [q, setQ] = useState("");
  const [helminthOnly, setHelminthOnly] = useState(false);
  const [all, setAll] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return abilities.filter((a) => (!helminthOnly || a.helminth) && (!needle || a.name.toLowerCase().includes(needle) || a.warframe.toLowerCase().includes(needle)));
  }, [abilities, q, helminthOnly]);
  const visible = all || q || helminthOnly ? filtered : filtered.slice(0, SHOWN);

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Works with <strong className="text-teal">{abilities.length} abilities</strong> that scale with {statLabels.join(" or ")}.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input max-w-xs flex-1" type="search" placeholder="Find an ability or Warframe…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search abilities" />
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-gold" checked={helminthOnly} onChange={(e) => setHelminthOnly(e.target.checked)} />
          <span><span className="text-gold">★</span> Helminth only</span>
        </label>
      </div>

      <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {visible.map((a) => (
          <li key={a.slug} className="flex items-baseline gap-1.5">
            <span className="text-teal">▸</span>
            <span>
              {a.name} <span className="text-dim">({a.warframe})</span>
              {a.helminth && <span className="ml-1 text-gold" title="Can be subsumed onto the Helminth">★</span>}
            </span>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && <p className="text-sm text-dim">No matching abilities.</p>}

      {!all && !q && !helminthOnly && filtered.length > SHOWN && (
        <button className="btn min-h-9 px-3 text-xs" onClick={() => setAll(true)}>Show all {filtered.length}</button>
      )}
      <p className="text-xs text-dim">
        <span className="text-gold">★</span> = can be subsumed onto the Helminth. Matched from the wiki’s ability stat data
        {unknownCount > 0 && <> — {unknownCount} abilities have no stat data there yet, so they aren’t listed</>}.
      </p>
    </div>
  );
}
