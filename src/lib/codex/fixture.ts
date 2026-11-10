import type { CodexRivenData } from "./types";

/**
 * A small slice of the REAL Codex data (same numbers the calculator uses), for tests and previews only.
 * The full dataset comes from `npm run sync:codex-riven`.
 */
export const CODEX_FIXTURE: CodexRivenData = {
  source: { url: "fixture", repo: "Unified-Codex/Codex-Calculators", commit: null, version: "5.5.9", sha256: "fixture", fetchedAt: "2026-01-01T00:00:00Z" },
  categories: ["Rifle", "Shotgun", "Pistol", "Archgun", "Melee / Zaw"],
  disposition: { factor: 1.2, decimals: 4 },
  stats: [
    { name: "Damage / Melee Damage", unit: "%", base: [165, 164.7, 219.6, 99.9, 164.7] },
    { name: "Critical Chance", unit: "%", base: [149.99, 90, 149.99, 99.9, 180] },
    { name: "Critical Damage", unit: "%", base: [119.997, 90, 90, 80.1, 90] },
    { name: "Cold Damage", unit: "%", base: [90, 90, 90, 119.7, 90] },
    { name: "Weapon Recoil", unit: "%", base: [90, 90, 90, 90, null] },
    { name: "Zoom", unit: "%", base: [59.99, 41.994, 80.1, 59.99, null] },
    { name: "Damage vs Infested", unit: "x", base: [0.45, 0.45, 0.45, 0.45, 0.45] },
    { name: "Combo Duration", unit: "s", base: [null, null, null, null, 8.1] },
  ],
  layouts: [
    { id: "2/0", positives: 2, negatives: 0, positiveMultiplier: 0.99, negativeMultiplier: 0 },
    { id: "2/1", positives: 2, negatives: 1, positiveMultiplier: 1.2375, negativeMultiplier: -0.495 },
    { id: "3/0", positives: 3, negatives: 0, positiveMultiplier: 0.75, negativeMultiplier: 0 },
    { id: "3/1", positives: 3, negatives: 1, positiveMultiplier: 0.9375, negativeMultiplier: -0.75 },
  ],
  roll: { min: 0.9, max: 1.1 },
  gradeBands: [
    { grade: "F", lower: -10, upper: -9.5 }, { grade: "C-", lower: -9.5, upper: -7.5 }, { grade: "C", lower: -7.5, upper: -5.5 },
    { grade: "C+", lower: -5.5, upper: -3.5 }, { grade: "B-", lower: -3.5, upper: -1.5 }, { grade: "B", lower: -1.5, upper: 1.5 },
    { grade: "B+", lower: 1.5, upper: 3.5 }, { grade: "A-", lower: 3.5, upper: 5.5 }, { grade: "A", lower: 5.5, upper: 7.5 },
    { grade: "A+", lower: 7.5, upper: 9.5 }, { grade: "S", lower: 9.5, upper: 10 },
  ],
  invertedStats: ["Weapon Recoil"],
  noNegative: ["Cold Damage"],
  weapons: [
    { name: "Soma", category: 0, bow: false }, { name: "Soma Prime", category: 0, bow: false }, { name: "Boltor", category: 0, bow: false },
    { name: "Galatine", category: 4, bow: false }, { name: "Lex", category: 2, bow: false }, { name: "Kuva Ayanga", category: 3, bow: false },
    { name: "Catchmoon (primary)", category: 1, bow: false }, { name: "Catchmoon (secondary)", category: 2, bow: false },
  ],
  statSlugs: {
    "base_damage_/_melee_damage": "Damage / Melee Damage", critical_chance: "Critical Chance", critical_damage: "Critical Damage", cold_damage: "Cold Damage",
    recoil: "Weapon Recoil", zoom: "Zoom", damage_vs_infested: "Damage vs Infested", combo_duration: "Combo Duration",
  },
};
