import { toMaxRank } from "@/lib/rank";
import { fmtStat } from "@/lib/format";
import type { RivenAttribute, RivenStat } from "@/lib/types";
import { bandFor, bandValueRanges, categoryForWeapon, centerOf, deviationPct, layoutFor, statFor, toCalcValue } from "@/lib/rivencalc/compute";
import type { RivenCalcData } from "@/lib/rivencalc/types";
import type { Tier } from "./config";

export interface BandRow { grade: Tier; from: number; to: number; fromPct: number; toPct: number }

export interface StatGrade {
  stat: string;
  /** Value normalised to max rank (what the calculator's ranges are defined against). */
  valueAtMax: number;
  tier: Tier | null;
  /** Position inside the roll range, 0 = worst end, 1 = best end (clamped). null when ungraded. */
  pct: number | null;
  /** Lowest/highest possible roll for this weapon type + layout, as displayed (signed). */
  range: { min: number; max: number } | null;
  /** Values at the two ends of the gauge: where pct = 0 and where pct = 1. */
  ends: { worst: number; best: number } | null;
  /** The calculator's grade table for this stat (best grade first) — shown in the "grade bands" panel. */
  bands: BandRow[];
  /** Value fell outside the possible range — usually a mistyped value or the wrong rank. */
  outOfRange: boolean;
  /** Context such as "Weapon type: Rifle · layout 3 positive, 1 negative". */
  context: string | null;
  /** Caveats about how the weapon category was chosen. */
  note: string | null;
  explanation: string;
}

const plain = (v: number, unit: string | null | undefined) => fmtStat(v, unit).replace(/^\+/, "");

/** "56–115%" / "x1.48–x1.59" / "-60% to -30%" — avoids a confusing "–-". */
function fmtRange(min: number, max: number, unit: string | null | undefined): string {
  if (min < 0 || max < 0) return `${plain(min, unit)} to ${plain(max, unit)}`;
  const suffix = unit === "percent" ? "%" : unit === "seconds" ? "s" : "";
  return suffix ? `${plain(min, unit).slice(0, -1)}–${plain(max, unit)}` : `${plain(min, unit)}–${plain(max, unit)}`;
}

function position(pct: number): string {
  if (pct >= 0.975) return "at the very top of";
  if (pct >= 0.875) return "near the top of";
  if (pct >= 0.675) return "in the upper part of";
  if (pct >= 0.575) return "slightly above the middle of";
  if (pct >= 0.425) return "around the middle of";
  if (pct >= 0.325) return "slightly below the middle of";
  if (pct >= 0.125) return "in the lower part of";
  if (pct >= 0.025) return "near the bottom of";
  return "at the very bottom of";
}

const ungraded = (stat: RivenStat, valueAtMax: number, text: string, extra: Partial<StatGrade> = {}): StatGrade => ({
  stat: stat.stat, valueAtMax, tier: null, pct: null, range: null, ends: null, bands: [], outOfRange: false, context: null, note: null, explanation: text, ...extra,
});

/**
 * Grade every stat of a riven with browse.wf's Riven Calculator data:
 *   range  = the calculator's min–max for this weapon type, layout and stat (a ±10% roll around the center);
 *   grade  = the band that the roll's deviation from the center falls in. A curse is graded the way the calculator
 *            grades it: the milder the penalty, the higher the grade.
 * Each stat is graded independently; there is no riven-wide grade.
 */
export function gradeRiven(
  riven: { rank: number; stats: RivenStat[] },
  weapon: { name: string; riven_type: string; group_name?: string | null },
  attrs: Map<string, RivenAttribute>,
  data: RivenCalcData | null,
): StatGrade[] {
  const positives = riven.stats.filter((s) => !s.is_negative).length;
  const negatives = riven.stats.length - positives;

  return riven.stats.map((stat): StatGrade => {
    const attr = attrs.get(stat.stat);
    const name = attr?.name ?? stat.stat;
    const wfmUnit = attr?.unit;
    const valueAtMax = toMaxRank(stat.value, riven.rank, wfmUnit);
    const shown = plain(valueAtMax, wfmUnit);
    const scaled = riven.rank < 8 ? ` (scaled to max rank from ${plain(stat.value, wfmUnit)} at rank ${riven.rank})` : "";
    const base = `${shown} ${name}${scaled}`;

    if (!data) return ungraded(stat, valueAtMax, `${base}: grading data isn’t loaded yet.`);
    const cat = categoryForWeapon(data, weapon);
    if (!cat) return ungraded(stat, valueAtMax, `${base}: couldn’t work out ${weapon.name}’s weapon type, so it can’t be graded.`);
    const layout = layoutFor(data, positives, negatives);
    if (!layout) return ungraded(stat, valueAtMax, `${base}: a riven with ${positives} positive and ${negatives} negative stats isn’t a layout the calculator covers.`, { note: cat.note });

    const found = statFor(data, stat.stat, cat.id, stat.is_negative, layout.id);
    if (found.kind === "unlisted") return ungraded(stat, valueAtMax, `${base}: the calculator has no range for this stat, so it can’t be graded.`, { note: cat.note });
    if (found.kind === "cannot-roll") return ungraded(stat, valueAtMax, `${base}: the calculator doesn’t list ${name} as a ${stat.is_negative ? "negative" : "positive"} stat on ${cat.name} weapons, so there’s no range to grade against. Check the weapon and stat.`, { note: cat.note });

    const { stat: def, range: raw } = found;
    const center = centerOf(raw, def.unit);
    const dev = deviationPct(toCalcValue(valueAtMax, def.unit), center);
    const flip = stat.is_negative && data.curseGrading === "inverted";
    const effDev = flip ? -dev : dev;
    const band = bandFor(data, effDev);
    const lo = data.gradeBands[0].lower, hi = data.gradeBands[data.gradeBands.length - 1].upper;
    const pct = Math.min(1, Math.max(0, (effDev - lo) / (hi - lo)));
    const outOfRange = Math.abs(dev) > data.outOfRangeDeviation;

    // raw = [value at the lowest roll multiplier, value at the highest]; for curses the first is the milder penalty.
    const range = { min: Math.min(raw[0], raw[1]), max: Math.max(raw[0], raw[1]) };
    const ends = flip ? { worst: raw[1], best: raw[0] } : { worst: raw[0], best: raw[1] };
    const bands = bandValueRanges(data, center, def.unit).map((b) => ({ ...b, grade: b.grade as Tier }));
    const rangeText = fmtRange(range.min, range.max, wfmUnit);

    let explanation = `${base} is ${position(pct)} this weapon’s ${rangeText} range → ${band.grade}`;
    if (stat.is_negative && flip) explanation += " (on a negative stat a milder penalty grades higher)";
    if (outOfRange) explanation += " (outside the possible range — check the value and rank)";

    return {
      stat: stat.stat, valueAtMax, tier: band.grade as Tier, pct, range, ends, bands, outOfRange,
      context: `${cat.name} · ${layout.buffs} positive${layout.buffs === 1 ? "" : "s"}${layout.curses ? ", 1 negative" : ""}`,
      note: cat.note, explanation,
    };
  });
}
