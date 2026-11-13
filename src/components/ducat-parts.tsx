"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plat } from "@/components/brand";

export interface DucatPart { slug: string; name: string; ducats: number; price: number; listings: number; vaulted: boolean | null }

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const SHOW = 12;

/** Prime parts ranked by how many ducats they give per platinum of their market price — the cheapest way to build up ducats for Baro. */
export function DucatParts({ rows }: { rows: DucatPart[] }) {
  const [tier, setTier] = useState(0); // 0 = any
  const [solid, setSolid] = useState(true);
  const [shown, setShown] = useState(SHOW);

  const tiers = useMemo(() => [...new Set(rows.map((r) => r.ducats))].sort((a, b) => b - a), [rows]);
  const list = useMemo(() => rows
    .filter((r) => (!tier || r.ducats === tier) && (!solid || r.listings >= 3))
    .map((r) => ({ ...r, perPlat: r.ducats / r.price, per100: (r.price / r.ducats) * 100 }))
    .sort((a, b) => b.perPlat - a.perPlat || a.name.localeCompare(b.name)), [rows, tier, solid]);
  const best = list[0];
  const topPerPlat = best?.perPlat ?? 1;

  return (
    <section className="space-y-3">
      <h2 className="kicker">Prime parts: cheapest ducats</h2>
      <div className="card space-y-3">
        <p className="text-sm text-dim">The parts that give the most ducats for the platinum they cost on Warframe Market (the average of the 5 cheapest online listings). Buy them cheap, trade them in to Baro for ducats, and spend the ducats on his items.</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-dim">Worth
            <select className="input !min-h-9 w-32 py-1" value={tier} onChange={(e) => { setTier(Number(e.target.value)); setShown(SHOW); }} aria-label="Ducat value">
              <option value={0}>any ducats</option>
              {tiers.map((t) => <option key={t} value={t}>{t} ducats</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-dim"><input type="checkbox" checked={solid} onChange={(e) => { setSolid(e.target.checked); setShown(SHOW); }} /> Hide thin markets (under 3 listings)</label>
        </div>
        {best && <p className="text-sm text-ink">Cheapest right now: <b>{best.name}</b> — <b className="text-teal">{fmt(Math.round(best.perPlat * 10) / 10)} ducats per platinum</b> ({fmt(Math.round(best.per100 * 10) / 10)}p per 100 ducats).</p>}

        {list.length === 0 ? <p className="text-sm text-dim">Nothing matches.</p> : (
          <ol className="space-y-2">
            {list.slice(0, shown).map((r, i) => (
              <li key={r.slug} className="space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="text-sm text-ink"><span className="mr-2 font-mono text-dim">{i + 1}</span><Link href={`/primes/${r.slug}`} className="hover:text-gold">{r.name}</Link>{r.vaulted === true && <span className="ml-2 text-xs text-orange">vaulted</span>}</p>
                  <p className="text-sm text-dim"><span className="h-display normal-case text-teal">{fmt(Math.round(r.perPlat * 10) / 10)}</span> ducats per plat · {r.ducats} ducats for <span className="text-plat">{fmt(r.price)}p</span> <Plat size={11} />{r.listings < 3 && <span className="ml-1 text-xs text-orange">thin</span>}</p>
                </div>
                <div className="h-1.5 w-full bg-line/60" aria-hidden="true"><div className="h-full bg-teal" style={{ width: `${Math.max(4, (r.perPlat / topPerPlat) * 100)}%` }} /></div>
              </li>
            ))}
          </ol>
        )}
        {list.length > shown && <button className="btn w-full" onClick={() => setShown((n) => n + SHOW)}>Show {Math.min(SHOW, list.length - shown)} more</button>}
        <p className="text-xs text-dim">Prices are asking prices from online / in-game sellers and move constantly — check the listing before you buy. Many of these parts are cheap because they’re common; a part that’s worth a lot as a part (high price) is usually better sold than converted.</p>
      </div>
    </section>
  );
}
