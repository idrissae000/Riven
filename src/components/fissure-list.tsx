"use client";

import { useMemo, useState } from "react";
import { Countdown } from "@/components/countdown";
import { Segmented } from "@/components/segmented";
import type { Fissure } from "@/lib/worldstate";

const TIERS = ["Lith", "Meso", "Neo", "Axi", "Requiem", "Omnia"];
const TIER_STYLE: Record<string, string> = { Lith: "text-dim", Meso: "text-teal", Neo: "text-violet", Axi: "text-gold", Requiem: "text-danger", Omnia: "text-orange" };
type Mode = "normal" | "steel" | "railjack";

/** Void fissures split into Normal / Steel Path / Railjack, grouped by relic tier. */
export function FissureList({ fissures }: { fissures: Fissure[] }) {
  const [mode, setMode] = useState<Mode>("normal");
  const [tier, setTier] = useState("");
  const [type, setType] = useState("");

  const modeOf = (f: Fissure): Mode => (f.storm ? "railjack" : f.steelPath ? "steel" : "normal");
  const counts = useMemo(() => ({ normal: fissures.filter((f) => modeOf(f) === "normal").length, steel: fissures.filter((f) => modeOf(f) === "steel").length, railjack: fissures.filter((f) => modeOf(f) === "railjack").length }), [fissures]);
  const inMode = useMemo(() => fissures.filter((f) => modeOf(f) === mode), [fissures, mode]);
  const tiers = TIERS.filter((t) => inMode.some((f) => f.tier === t));
  const types = useMemo(() => [...new Set(inMode.map((f) => f.missionType))].sort(), [inMode]);
  const list = inMode.filter((f) => (!tier || f.tier === tier) && (!type || f.missionType === type));
  const groups = (tier ? [tier] : tiers).map((t) => ({ tier: t, rows: list.filter((f) => f.tier === t) })).filter((g) => g.rows.length);

  const switchMode = (m: Mode) => { setMode(m); setTier(""); setType(""); };

  return (
    <div className="space-y-4">
      <Segmented label="Fissure type" value={mode} onChange={switchMode} options={[
        { value: "normal", label: "Normal", count: counts.normal }, { value: "steel", label: "Steel Path", count: counts.steel }, { value: "railjack", label: "Railjack", count: counts.railjack },
      ]} />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented size="sm" label="Relic tier" value={tier} onChange={setTier} options={[{ value: "", label: "All" }, ...tiers.map((t) => ({ value: t, label: t }))]} />
        {types.length > 1 && (
          <select className="input !min-h-8 !w-auto !py-1 text-xs" value={type} onChange={(e) => setType(e.target.value)} aria-label="Mission type">
            <option value="">Any mission</option>{types.map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
      </div>

      {groups.length === 0 && <p className="text-sm text-dim">No fissures match.</p>}
      <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
        {groups.map((g) => (
          <section key={g.tier}>
            <h3 className={`mb-1 flex items-baseline gap-2 border-b border-line pb-1 font-display text-xs font-bold uppercase tracking-[0.2em] ${TIER_STYLE[g.tier] ?? ""}`}>{g.tier}<span className="font-mono text-[0.65rem] text-dim">{g.rows.length}</span></h3>
            <ul>
              {g.rows.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate"><b className="font-medium">{f.missionType}</b><span className="text-dim"> · {f.node}</span></span>
                  <Countdown to={f.expiry} className="shrink-0 text-xs text-dim" />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
