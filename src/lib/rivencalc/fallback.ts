import type { CodexRivenData } from "../codex-fallback/types";
import type { RivenCalcData, RivenCalcFallback, StatDef } from "./types";

/** The Codex's weapon categories → browse.wf's (the Codex has one table for pistols/kitguns and one for melee/zaws). */
const CATEGORY_MAP: Record<string, string[]> = {
  Rifle: ["Rifle"], Shotgun: ["Shotgun"], Pistol: ["Pistol", "Kitgun"], Archgun: ["Archgun"], "Melee / Zaw": ["Melee", "Zaw"],
};
const UNIT: Record<string, StatDef["unit"]> = { "%": "percent", x: "multiply", s: "seconds", m: "", "": "" };
const num = (v: number) => Number(v.toPrecision(10));

/**
 * Ranges from the Unified-Codex calculator for every Warframe Market stat that browse.wf has no range for — either the
 * stat isn't on browse.wf at all, or not for that weapon category / bonus-or-penalty. Codex math: center =
 * round4(table × 1.2) × layout multiplier (× −1 for Weapon Recoil); the roll is ±10% (the same factors browse.wf uses).
 * Wherever browse.wf has a range, it wins and nothing is added here.
 */
export function buildFallback(codex: CodexRivenData, calc: RivenCalcData, slugToCodexName: Record<string, string>, source: RivenCalcFallback["source"]): { fallback: RivenCalcFallback; filled: string[] } {
  for (const c of codex.categories) if (!CATEGORY_MAP[c]) throw new Error(`Codex source changed: weapon category "${c}" has no browse.wf equivalent (update CATEGORY_MAP in src/lib/rivencalc/fallback.ts)`);
  if (codex.disposition.factor !== calc.disposition) throw new Error(`Codex scales its table by ${codex.disposition.factor}, browse.wf is locked at ${calc.disposition}`);

  const ranges: RivenCalcFallback["ranges"] = {};
  const units: RivenCalcFallback["units"] = {};
  const filled = new Set<string>();

  for (const [slug, name] of Object.entries(slugToCodexName)) {
    const stat = codex.stats.find((s) => s.name === name);
    if (!stat) throw new Error(`stat map: ${slug} → "${name}" is not a stat in the Codex calculator (renamed?)`);
    const unit = UNIT[stat.unit];
    const flip = codex.invertedStats.includes(name) ? -1 : 1;
    const tags = calc.statSlugs[slug] ?? [];
    codex.categories.forEach((codexCat, ci) => {
      const base = stat.base[ci];
      if (base == null) return;
      const scaled = +(base * codex.disposition.factor).toFixed(codex.disposition.decimals);
      for (const catName of CATEGORY_MAP[codexCat]) {
        const cat = calc.categories.find((c) => c.name === catName);
        if (!cat) continue;
        for (const lay of codex.layouts) {
          if (!calc.layouts.some((l) => l.id === lay.id)) continue;
          for (const kind of ["buffs", "curses"] as const) {
            if (kind === "curses" && (lay.negatives === 0 || codex.noNegative.includes(name))) continue;
            const mine = calc.ranges[cat.id]?.[lay.id]?.[kind] ?? {};
            if (tags.some((t) => t in mine)) continue; // browse.wf has it
            const center = scaled * (kind === "curses" ? lay.negativeMultiplier : lay.positiveMultiplier) * flip;
            const pair = [center * codex.roll.min, center * codex.roll.max].map((v) => num(unit === "multiply" ? v + 1 : v)) as [number, number];
            ((ranges[cat.id] ??= {})[lay.id] ??= { buffs: {}, curses: {} })[kind][slug] = pair;
            units[slug] = unit;
            filled.add(slug);
          }
        }
      }
    });
  }
  return { fallback: { source, units, ranges }, filled: [...filled].sort() };
}
