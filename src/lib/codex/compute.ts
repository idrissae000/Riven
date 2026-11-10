import type { CodexGradeBand, CodexLayout, CodexRivenData, CodexStat } from "./types";

/**
 * The Codex calculator's math, applied to our rivens. Pure functions over CodexRivenData.
 * All "value" arguments are SIGNED DISPLAY values at MAX RANK, except `x` (multiplier) stats, where the
 * calculator works with the part above ×1 — see `toCalcValue`.
 */

const round = (v: number, d: number) => +v.toFixed(d);

export const findStat = (data: CodexRivenData, name: string): CodexStat | undefined => data.stats.find((s) => s.name === name);

/** The table value for a stat in a category after the disposition factor (what the calculator calls "base"). */
export function scaledBase(data: CodexRivenData, stat: CodexStat, category: number): number | null {
  const raw = stat.base[category];
  return raw == null ? null : round(raw * data.disposition.factor, data.disposition.decimals);
}

/** 2 bonus + 0 curse etc. null when the stat counts aren't one of the calculator's layouts. */
export function layoutFor(data: CodexRivenData, positives: number, negatives: number): CodexLayout | null {
  return data.layouts.find((l) => l.positives === positives && l.negatives === negatives) ?? null;
}

/** Signed center value: base × layout multiplier, flipped for inverted stats (Weapon Recoil). */
export function centerFor(data: CodexRivenData, stat: CodexStat, category: number, layout: CodexLayout, isNegative: boolean): number | null {
  const base = scaledBase(data, stat, category);
  if (base == null) return null;
  const flip = data.invertedStats.includes(stat.name) ? -1 : 1;
  return base * (isNegative ? layout.negativeMultiplier : layout.positiveMultiplier) * flip;
}

/** Lowest/highest roll as the calculator computes them (lo = center × rollMin, hi = center × rollMax). */
export function rollRange(data: CodexRivenData, center: number) {
  const lo = center * data.roll.min;
  const hi = center * data.roll.max;
  return { lo, hi, min: Math.min(lo, hi), max: Math.max(lo, hi) };
}

/** "x" stats are shown as ×(1+x); the calculator's numbers are x. */
export const toCalcValue = (displayValue: number, unit: CodexStat["unit"]) => (unit === "x" ? displayValue - 1 : displayValue);
export const toDisplayValue = (calcValue: number, unit: CodexStat["unit"]) => (unit === "x" ? calcValue + 1 : calcValue);

/** Deviation of a roll from its center, in percent. Same formula for bonuses and curses, so it is sign-safe. */
export const deviationPct = (value: number, center: number) => (value / center - 1) * 100;

/** Band containing a deviation. Past either end clamps to F / S (and the caller can flag it). */
export function bandFor(data: CodexRivenData, deviation: number): CodexGradeBand {
  const bands = data.gradeBands;
  if (deviation <= bands[0].lower) return bands[0];
  for (const b of bands) if (deviation >= b.lower && deviation < b.upper) return b;
  return bands[bands.length - 1];
}

/** A band as percentages of the FULL min–max roll range (0% = lowest roll, 100% = highest). */
export function bandAsRangePercent(data: CodexRivenData, band: CodexGradeBand) {
  const lo = data.gradeBands[0].lower, hi = data.gradeBands[data.gradeBands.length - 1].upper;
  return { fromPct: round(((band.lower - lo) / (hi - lo)) * 100, 6), toPct: round(((band.upper - lo) / (hi - lo)) * 100, 6) };
}

/** The value range of every band for one stat — the calculator's "Show Grade Ranges" table (best grade first). */
export function bandValueRanges(data: CodexRivenData, center: number, unit: CodexStat["unit"]) {
  return [...data.gradeBands].reverse().map((b) => ({
    grade: b.grade,
    from: toDisplayValue(center * (1 + b.lower / 100), unit),
    to: toDisplayValue(center * (1 + b.upper / 100), unit),
    ...bandAsRangePercent(data, b),
  }));
}

const TYPE_FALLBACK: Record<string, string> = { rifle: "Rifle", shotgun: "Shotgun", pistol: "Pistol", kitgun: "Pistol", melee: "Melee / Zaw", zaw: "Melee / Zaw" };

/**
 * Which of the calculator's weapon categories a weapon belongs to. Uses the calculator's own weapon list by name;
 * falls back to Warframe Market's riven type for weapons it doesn't list. Kitguns appear twice in the calculator
 * (primary / secondary chamber): we use the secondary (Pistol) values and say so via `note`.
 */
export function categoryForWeapon(
  data: CodexRivenData,
  weapon: { name: string; riven_type: string; group_name?: string | null },
): { index: number; note: string | null } | null {
  const key = weapon.name.trim().toLowerCase();
  const exact = data.weapons.find((w) => w.name.toLowerCase() === key);
  if (exact) return { index: exact.category, note: null };
  const variants = data.weapons.filter((w) => w.name.toLowerCase().startsWith(key + " ("));
  if (variants.length) {
    const pistol = data.categories.indexOf("Pistol");
    const pick = variants.find((v) => v.category === pistol) ?? variants[0];
    return { index: pick.category, note: variants.length > 1 ? `${weapon.name} comes in several variants; using the ${data.categories[pick.category]} values.` : null };
  }
  const name = weapon.group_name === "archgun" ? "Archgun" : TYPE_FALLBACK[weapon.riven_type];
  const index = name ? data.categories.indexOf(name) : -1;
  return index >= 0 ? { index, note: `${weapon.name} isn't in the calculator's weapon list; using the ${name} category.` } : null;
}
