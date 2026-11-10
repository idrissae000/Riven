import raw from "../../../data/curse-ratings.json";
import type { Tier } from "./config";

/** The grades a curse can be given (a fixed rating, so no +/-). */
export const CURSE_GRADES = ["S", "A", "B", "C", "D", "F"] as const satisfies readonly Tier[];

export interface CurseRatings {
  stats: Record<string, string>;
  /** weapon name (lower-cased) -> stat slug -> grade */
  weapons: Record<string, Record<string, string>>;
}

/** Reads data/curse-ratings.json (underscore keys are comments). Throws on an unknown grade so a typo can't go unnoticed. */
export function parseCurseRatings(file: { stats?: Record<string, unknown>; weapons?: Record<string, unknown> }): CurseRatings {
  const ok = (g: unknown, where: string): string => {
    if (typeof g !== "string" || !(CURSE_GRADES as readonly string[]).includes(g)) throw new Error(`curse-ratings.json: ${where} has grade ${JSON.stringify(g)}; use one of ${CURSE_GRADES.join(", ")}`);
    return g;
  };
  const stats: CurseRatings["stats"] = {};
  for (const [slug, g] of Object.entries(file.stats ?? {})) if (!slug.startsWith("_")) stats[slug] = ok(g, `stats.${slug}`);
  const weapons: CurseRatings["weapons"] = {};
  for (const [name, per] of Object.entries(file.weapons ?? {})) {
    if (name.startsWith("_")) continue;
    weapons[name.trim().toLowerCase()] = {};
    for (const [slug, g] of Object.entries((per ?? {}) as Record<string, unknown>)) if (!slug.startsWith("_")) weapons[name.trim().toLowerCase()][slug] = ok(g, `weapons.${name}.${slug}`);
  }
  return { stats, weapons };
}

export const CURSE_RATINGS: CurseRatings = parseCurseRatings(raw);

/** The fixed grade for a curse on this stat, on this weapon: the weapon's own entry first, then the stat's general rating. */
export function curseRatingFor(ratings: CurseRatings, slug: string, weaponName: string): { grade: Tier; source: "weapon" | "stat" } | null {
  const w = ratings.weapons[weaponName.trim().toLowerCase()]?.[slug];
  if (w) return { grade: w as Tier, source: "weapon" };
  const s = ratings.stats[slug];
  return s ? { grade: s as Tier, source: "stat" } : null;
}
