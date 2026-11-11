"use client";

import { useMemo, useState } from "react";
import { Countdown } from "@/components/countdown";
import type { Fissure } from "@/lib/worldstate";

const TIER_STYLE: Record<string, string> = { Lith: "text-dim", Meso: "text-teal", Neo: "text-violet", Axi: "text-gold", Requiem: "text-danger", Omnia: "text-orange" };

/** Void fissures, filterable by relic tier, mission type and Steel Path. */
export function FissureList({ fissures }: { fissures: Fissure[] }) {
  const [tier, setTier] = useState("");
  const [type, setType] = useState("");
  const [sp, setSp] = useState<"" | "normal" | "steel">("");
  const tiers = useMemo(() => [...new Set(fissures.map((f) => f.tier))], [fissures]);
  const types = useMemo(() => [...new Set(fissures.map((f) => f.missionType))].sort(), [fissures]);
  const list = fissures.filter((f) => (!tier || f.tier === tier) && (!type || f.missionType === type) && (!sp || (sp === "steel") === f.steelPath));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <select className="input" value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Relic tier"><option value="">All tiers</option>{tiers.map((t) => <option key={t}>{t}</option>)}</select>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Mission type"><option value="">All missions</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
        <select className="input" value={sp} onChange={(e) => setSp(e.target.value as "" | "normal" | "steel")} aria-label="Steel Path">
          <option value="">Normal + Steel Path</option><option value="normal">Normal only</option><option value="steel">Steel Path only</option>
        </select>
      </div>
      <ul className="divide-y divide-line">
        {list.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <span className={`mr-2 font-display text-xs font-bold uppercase tracking-wider ${TIER_STYLE[f.tier] ?? ""}`}>{f.tier}</span>
              <span className="font-medium">{f.missionType}</span>
              <span className="text-dim"> · {f.node}</span>
              {f.steelPath && <span className="chip ml-2 border-orange/50 text-orange">Steel Path</span>}
              {f.storm && <span className="chip ml-2">Railjack</span>}
            </div>
            <Countdown to={f.expiry} className="shrink-0 text-xs text-dim" />
          </li>
        ))}
        {list.length === 0 && <li className="py-3 text-sm text-dim">No fissures match.</li>}
      </ul>
    </div>
  );
}
