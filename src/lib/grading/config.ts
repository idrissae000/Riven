/** The calculator's grades, best to worst. (The old S–F set was our own invention; these are the real bands.) */
export const GRADES = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "F"] as const;
export type Tier = (typeof GRADES)[number];

/** Colour family for a grade: its letter. */
export const gradeGroup = (g: Tier) => g[0] as "S" | "A" | "B" | "C" | "F";
