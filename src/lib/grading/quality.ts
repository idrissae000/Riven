import type { StatGrade } from "./grade";

/** What a curse's fixed rating is worth on a 0 (worst) … 1 (best) scale. */
const CURSE_VALUE: Record<string, number> = { S: 1, A: 0.8, B: 0.6, C: 0.4, D: 0.2, F: 0 };

/** Share of the overall quality score that comes from the curse (when there is one). */
const CURSE_SHARE = 0.25;

/**
 * 0 (worst) … 1 (best) quality of one stat: a positive stat's position in its roll range, or — for a curse with a
 * fixed rating — what that rating is worth. null when the stat couldn't be graded.
 */
export function statQuality(g: StatGrade, isNegative: boolean): number | null {
  if (isNegative && (g.gradeSource === "curse-weapon" || g.gradeSource === "curse-stat") && g.tier) return CURSE_VALUE[g.tier[0]] ?? null;
  return g.pct;
}

/**
 * One 0…1 number for a whole riven, built from its per-stat grades: the mean quality of the positive stats, blended
 * with the curse's quality when it has one. Used to compare two rivens that carry the same stats (the market
 * valuation). null when no positive stat could be graded.
 */
export function rivenQuality(grades: StatGrade[], stats: { is_negative: boolean }[]): number | null {
  const pos: number[] = [];
  let curse: number | null = null;
  grades.forEach((g, i) => {
    const q = statQuality(g, !!stats[i]?.is_negative);
    if (q == null) return;
    if (stats[i]?.is_negative) curse ??= q;
    else pos.push(q);
  });
  if (!pos.length) return null;
  const mean = pos.reduce((a, b) => a + b, 0) / pos.length;
  return curse == null ? mean : (1 - CURSE_SHARE) * mean + CURSE_SHARE * curse;
}
