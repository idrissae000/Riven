/** Grades, best to worst. Roll bands use the calculator's S … C- and F; "D" is only ever a fixed curse rating. */
export const GRADES = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"] as const;
export type Tier = (typeof GRADES)[number];

/** Colour family for a grade: its letter. */
export const gradeGroup = (g: Tier) => g[0] as "S" | "A" | "B" | "C" | "D" | "F";
