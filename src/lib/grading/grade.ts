import { toMaxRank } from "@/lib/rank";
import { fmtStat } from "@/lib/format";
import type { RivenAttribute, RivenStat } from "@/lib/types";
import { DEFAULT_WEAPON, TIER_THRESHOLDS, type Tier } from "./config";

export interface GradeRange {
  weapon_slug: string;
  stat_slug: string;
  is_negative: boolean;
  min_roll: number; // signed, as displayed at max rank; min_roll <= max_roll
  max_roll: number;
  is_placeholder: boolean;
}

export interface StatGrade {
  stat: string;
  /** Value normalised to max rank (what the range is defined against). */
  valueAtMax: number;
  tier: Tier | null;
  /** 0 = worst possible roll, 1 = best possible roll; clamped. null when ungraded. */
  pct: number | null;
  range: { min: number; max: number } | null;
  placeholder: boolean;
  /** Value fell outside the known range — a sign the range data needs checking. */
  outOfRange: boolean;
  explanation: string;
}

export function tierForPct(pct: number): Tier {
  for (const t of TIER_THRESHOLDS) if (pct >= t.min) return t.tier;
  return "F";
}

/** weapon-specific row first, then the '*' default. */
export function lookupRange(ranges: GradeRange[], weapon: string, stat: string, isNegative: boolean): GradeRange | null {
  const hit = (w: string) => ranges.find((r) => r.weapon_slug === w && r.stat_slug === stat && r.is_negative === isNegative);
  return hit(weapon) ?? hit(DEFAULT_WEAPON) ?? null;
}

function position(pct: number): string {
  if (pct >= 0.9) return "near the top of";
  if (pct >= 0.75) return "in the upper part of";
  if (pct >= 0.55) return "above the middle of";
  if (pct >= 0.35) return "around the middle of";
  if (pct >= 0.15) return "in the lower part of";
  return "near the bottom of";
}

/** Unsigned display, matching in-game wording: "112%", "x1.48", "30s". */
const plain = (v: number, unit: string | null | undefined) => fmtStat(v, unit).replace(/^\+/, "");

/** "56–115%" / "x1.48–x1.59" / "-60% to -30%" — avoids a confusing "–-". */
function fmtRange(min: number, max: number, unit: string | null | undefined): string {
  if (min < 0 || max < 0) return `${plain(min, unit)} to ${plain(max, unit)}`;
  const suffix = unit === "percent" ? "%" : unit === "seconds" ? "s" : "";
  return suffix ? `${plain(min, unit).slice(0, -1)}–${plain(max, unit)}` : `${plain(min, unit)}–${plain(max, unit)}`;
}

/**
 * Grade ONE stat independently of the others, by where its rolled value falls between
 * the known min and max roll for that weapon/stat, on a linear scale.
 *
 * Direction: higher is better — except for `inverted` attributes (Weapon Recoil), where
 * lower is better. That single rule also covers curses: a curse of -30 beats -60 because
 * -30 is the larger number.
 */
export function gradeStat(
  stat: RivenStat,
  rank: number,
  weaponSlug: string,
  weaponName: string,
  attr: RivenAttribute | undefined,
  ranges: GradeRange[],
): StatGrade {
  const name = attr?.name ?? stat.stat;
  const unit = attr?.unit;
  const valueAtMax = toMaxRank(stat.value, rank, unit);
  const range = lookupRange(ranges, weaponSlug, stat.stat, stat.is_negative);
  const shown = plain(valueAtMax, unit);
  const scaled = rank < 8 ? ` (scaled to max rank from ${plain(stat.value, unit)} at rank ${rank})` : "";

  if (!range || range.max_roll <= range.min_roll) {
    return {
      stat: stat.stat, valueAtMax, tier: null, pct: null, range: null, placeholder: false, outOfRange: false,
      explanation: `${shown} ${name}${scaled}: no roll range on file for ${weaponName}, so it can’t be graded yet.`,
    };
  }

  const { min_roll: min, max_roll: max } = range;
  const raw = attr?.inverted ? (max - valueAtMax) / (max - min) : (valueAtMax - min) / (max - min);
  const pct = Math.min(1, Math.max(0, raw));
  const tier = tierForPct(pct);
  const outOfRange = raw < -0.02 || raw > 1.02;
  const r = fmtRange(min, max, unit);

  let explanation: string;
  if (stat.is_negative) {
    const severity = pct >= 0.65 ? "a mild" : pct >= 0.35 ? "a moderate" : "a harsh";
    explanation = `${shown} ${name}${scaled} is ${severity} penalty — ${position(pct)} this weapon’s ${r} penalty range (smaller is better) → ${tier}`;
  } else {
    explanation = `${shown} ${name}${scaled} is ${position(pct)} this weapon’s ${r} range → ${tier}`;
  }
  if (outOfRange) explanation += " (outside the known range — check the range data)";
  return { stat: stat.stat, valueAtMax, tier, pct, range: { min, max }, placeholder: range.is_placeholder, outOfRange, explanation };
}

export function gradeRiven(
  riven: { weapon_slug: string; rank: number; stats: RivenStat[] },
  weaponName: string,
  attrs: Map<string, RivenAttribute>,
  ranges: GradeRange[],
): StatGrade[] {
  return riven.stats.map((s) => gradeStat(s, riven.rank, riven.weapon_slug, weaponName, attrs.get(s.stat), ranges));
}
