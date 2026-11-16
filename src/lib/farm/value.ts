export interface Drop { n: string; c: number }
export interface MissionNode { planet: string; node: string; mode: string; tables: Record<string, { total: number; items: Drop[] }> }
export interface RewardData { fetchedAt: string; nodes: MissionNode[]; relics: Record<string, { intact: Drop[]; radiant: Drop[] }> }

/** Modes whose rewards come in rotations that go A, A, B, C and repeat. */
export const ENDLESS = new Set(["Survival", "Defense", "Excavation", "Interception"]);

export interface Priced { value: number; relics: number; unpriced: boolean }
export interface MissionRow {
  planet: string; node: string; mode: string;
  /** Expected platinum from one reward of each rotation table (A, B, C…). */
  rotations: Record<string, number>;
  /** Endless modes: A + A + B + C, one full cycle of four. Null for the rest. */
  cycle: number | null;
  /** Non-endless: the best single reward table. */
  run: number | null;
  /** What drives the value: the biggest contributors across the counted tables. */
  top: { name: string; plat: number }[];
  /** How much of the table (by chance) is relics and arcanes, i.e. priced. The rest (mods, resources, credits…) isn't, so these are floors. */
  pricedShare: number;
  /** Relics in the table whose contents we couldn't fully price (new or thin parts). */
  gaps: number;
}

/**
 * Expected platinum of one relic opening: each reward's chance × its price. Forma is untradable (0, not a gap). A part with no usable price counts 0 and
 * makes the value a floor. `partPrice` returns null for an unknown or thin market.
 */
export function valueRelic(drops: Drop[], partPrice: (name: string) => number | null): { ev: number; gap: boolean } {
  let ev = 0, gap = false;
  for (const d of drops) {
    if (/forma blueprint$/i.test(d.n)) continue;
    const p = partPrice(d.n);
    if (p == null) gap = true; else ev += (d.c / 100) * p;
  }
  return { ev: Math.round(ev * 10) / 10, gap };
}

/** Ranks the missions by the platinum their relic and arcane rewards are worth. */
export function rankMissions(data: RewardData, partPrice: (name: string) => number | null, arcanePrice: (name: string) => number | null, state: "intact" | "radiant" = "intact"): MissionRow[] {
  const relicEv = new Map<string, { ev: number; gap: boolean }>();
  for (const [name, v] of Object.entries(data.relics)) relicEv.set(name, valueRelic(v[state], partPrice));
  const itemValue = (n: string): { plat: number; gap: boolean } => {
    if (/ Relic$/.test(n)) { const r = relicEv.get(n.replace(/ Relic$/, "")); return r ? { plat: r.ev, gap: r.gap } : { plat: 0, gap: true }; }
    const p = arcanePrice(n);
    return { plat: p ?? 0, gap: p == null };
  };

  return data.nodes.map((node): MissionRow => {
    const rotations: Record<string, number> = {};
    const contrib = new Map<string, number>();
    let priced = 0, total = 0, gaps = 0;
    for (const [rot, t] of Object.entries(node.tables)) {
      let ev = 0;
      for (const d of t.items) {
        const v = itemValue(d.n);
        const plat = (d.c / 100) * v.plat;
        ev += plat; priced += d.c; if (v.gap) gaps++;
        contrib.set(d.n, (contrib.get(d.n) ?? 0) + plat);
      }
      total += t.total;
      rotations[rot] = Math.round(ev * 10) / 10;
    }
    const cycle = ENDLESS.has(node.mode) && rotations.A != null && rotations.B != null && rotations.C != null ? Math.round((2 * rotations.A + rotations.B + rotations.C) * 10) / 10 : null;
    return {
      planet: node.planet, node: node.node, mode: node.mode, rotations, cycle,
      run: cycle == null ? Math.max(0, ...Object.values(rotations)) : null,
      top: [...contrib.entries()].map(([name, plat]) => ({ name, plat: Math.round(plat * 10) / 10 })).filter((x) => x.plat > 0).sort((a, b) => b.plat - a.plat).slice(0, 3),
      pricedShare: total > 0 ? Math.round((priced / total) * 100) : 0, gaps,
    };
  });
}
