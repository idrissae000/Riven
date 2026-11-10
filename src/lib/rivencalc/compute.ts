import type { GradeBand, RivenCalcData, StatDef } from "./types";

/**
 * Applies the browse.wf calculator's data to our rivens. Pure functions over RivenCalcData.
 * Values are what a player sees (percent as 185.6, "x" stats as 1.41), signed, at the data's rank (max).
 */

const round = (v: number, d: number) => +v.toFixed(d);

export const findStat = (data: RivenCalcData, tag: string): StatDef | undefined => data.stats.find((s) => s.tag === tag);

/** null when the counts aren't one of the tabulated layouts. */
export function layoutFor(data: RivenCalcData, buffs: number, curses: number) {
  return data.layouts.find((l) => l.buffs === buffs && l.curses === curses) ?? null;
}

/** The calculator's stat for a Warframe Market slug in this category (a slug can have a ranged and a melee tag). */
export function statFor(data: RivenCalcData, slug: string, categoryId: string, isCurse: boolean, layoutId: string) {
  const tags = data.statSlugs[slug];
  if (!tags) return { kind: "unlisted" as const };
  const table = data.ranges[categoryId]?.[layoutId]?.[isCurse ? "curses" : "buffs"] ?? {};
  const tag = tags.find((t) => t in table);
  if (!tag) return { kind: "cannot-roll" as const, tag: tags[0] };
  return { kind: "ok" as const, tag, stat: findStat(data, tag)!, range: table[tag] };
}

/** "x" stats are shown as ×(1+x); deviation is measured on the part above ×1. */
export const toCalcValue = (shown: number, unit: StatDef["unit"]) => (unit === "multiply" ? shown - 1 : shown);
export const toDisplayValue = (calc: number, unit: StatDef["unit"]) => (unit === "multiply" ? calc + 1 : calc);

/** Signed center of a range, in calculation units (the roll multiplier is symmetric: 0.9–1.1 → ×1). */
export function centerOf(range: [number, number], unit: StatDef["unit"]): number {
  return (toCalcValue(range[0], unit) + toCalcValue(range[1], unit)) / 2;
}

/** Deviation of a roll from its center, in percent. Sign-safe for bonuses, curses and Weapon Recoil. */
export const deviationPct = (calcValue: number, center: number) => (calcValue / center - 1) * 100;

/** Band containing a deviation. Past either end clamps to the lowest / highest grade (callers flag out-of-range). */
export function bandFor(data: RivenCalcData, deviation: number): GradeBand {
  const bands = data.gradeBands;
  if (deviation <= bands[0].lower) return bands[0];
  for (const b of bands) if (deviation >= b.lower && deviation < b.upper) return b;
  return bands[bands.length - 1];
}

/** A band as percentages of the FULL min–max roll range (0% = lowest roll, 100% = highest). */
export function bandAsRangePercent(data: RivenCalcData, band: GradeBand) {
  const lo = data.gradeBands[0].lower, hi = data.gradeBands[data.gradeBands.length - 1].upper;
  return { fromPct: round(((band.lower - lo) / (hi - lo)) * 100, 6), toPct: round(((band.upper - lo) / (hi - lo)) * 100, 6) };
}

/** The value range of every band for one stat (best grade first), as the player sees the numbers. */
export function bandValueRanges(data: RivenCalcData, center: number, unit: StatDef["unit"]) {
  return [...data.gradeBands].reverse().map((b) => ({
    grade: b.grade,
    from: toDisplayValue(center * (1 + b.lower / 100), unit),
    to: toDisplayValue(center * (1 + b.upper / 100), unit),
    ...bandAsRangePercent(data, b),
  }));
}

/**
 * Which of the calculator's weapon categories a weapon belongs to: its own weapon list by name (kitgun chambers and
 * zaw strikes included), falling back to Warframe Market's riven type for weapons it doesn't list.
 */
export function categoryForWeapon(
  data: RivenCalcData,
  weapon: { name: string; riven_type: string; group_name?: string | null },
): { id: string; name: string; note: string | null } | null {
  const cat = (id: string) => data.categories.find((c) => c.id === id)!;
  const key = weapon.name.trim().toLowerCase();
  const exact = data.weapons.find((w) => w.name.toLowerCase() === key);
  if (exact) return { ...cat(exact.category), note: null };
  const variant = data.weapons.find((w) => w.name.toLowerCase().startsWith(key + " ("));
  if (variant) return { ...cat(variant.category), note: null };
  const wanted = weapon.group_name === "archgun" ? "archgun" : weapon.riven_type.toLowerCase();
  const byType = data.categories.find((c) => c.name.toLowerCase() === wanted);
  return byType ? { ...byType, note: `${weapon.name} isn't in the calculator's weapon list; using the ${byType.name} category.` } : null;
}
