export type Tier = "S" | "A" | "B" | "C" | "D" | "F";

/**
 * Tier boundaries as a fraction of the way from the worst to the best possible roll
 * (0 = worst possible, 1 = best possible). Linear scale, per the spec:
 * e.g. in a 100–150 range, 150 = S and 100 = F. Tweak here to re-bucket.
 */
export const TIER_THRESHOLDS: { tier: Tier; min: number }[] = [
  { tier: "S", min: 0.9 },
  { tier: "A", min: 0.75 },
  { tier: "B", min: 0.55 },
  { tier: "C", min: 0.35 },
  { tier: "D", min: 0.15 },
  { tier: "F", min: 0 },
];

/** Wildcard weapon_slug: the default range used when a weapon has no specific row. */
export const DEFAULT_WEAPON = "*";
