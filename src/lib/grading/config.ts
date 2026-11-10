/** The calculator's grades, best to worst. (The old S–F set was our own invention; these are the real bands.) */
export const GRADES = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "F"] as const;
export type Tier = (typeof GRADES)[number];

/** Colour family for a grade: its letter. */
export const gradeGroup = (g: Tier) => g[0] as "S" | "A" | "B" | "C" | "F";

/**
 * How NEGATIVE stats are graded.
 *  - "magnitude" (default): exactly the Codex calculator's convention — "Higher grades mean greater roll magnitude,
 *    including for negatives." So the biggest penalty roll is an S and the mildest an F.
 *  - "benefit": flip it, so the mildest penalty is the best grade.
 * Bonuses are unaffected. Players coming from the Codex tool expect "magnitude".
 */
export const NEGATIVE_STAT_GRADING: "magnitude" | "benefit" = "magnitude";

/** How far (in percentage points of the center) a displayed value may sit outside ±10% before we flag it. Covers display rounding. */
export const OUT_OF_RANGE_TOLERANCE = 0.15;
