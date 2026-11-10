/**
 * The Codex Riven Calculator's reference data (https://unified-codex.github.io/Codex-Calculators/?tool=riven),
 * extracted by `npm run sync:codex-riven` and stored in Supabase (`riven_grading_data`). Everything here comes
 * from the calculator's own source; nothing is hand-entered.
 *
 * The math (as written in the calculator's code):
 *   scaledBase = round4(rawBase * dispositionFactor)            // table values are stored at disposition 1.0
 *   center     = scaledBase * layoutMultiplier * (inverted ? -1 : 1)
 *   roll range = center * rollMin  ..  center * rollMax         // flat +/-10%
 *   grade      = band containing the roll's deviation from center, as a % (-10 .. +10)
 */
export interface CodexRivenData {
  source: {
    url: string;
    repo: string;
    /** Git commit of index.html when known. */
    commit: string | null;
    /** Calculator version from <meta name="riven-version">. */
    version: string | null;
    /** sha256 of the index.html the data was read from, to detect changes cheaply. */
    sha256: string;
    fetchedAt: string;
  };
  /** Weapon categories, in the order of each stat's `base` array: Rifle, Shotgun, Pistol, Archgun, Melee / Zaw. */
  categories: string[];
  /** Every table value is multiplied by this (the normalised 1.2x disposition) and rounded to `decimals`. */
  disposition: { factor: number; decimals: number };
  stats: CodexStat[];
  layouts: CodexLayout[];
  /** The random roll: value = center * (rollMin .. rollMax). Parsed from the calculator code (lo=e*.9, hi=e*1.1). */
  roll: { min: number; max: number };
  /** Grade bands exactly as the calculator defines them: bounds are the roll's deviation from center, in percent. */
  gradeBands: CodexGradeBand[];
  /** Stats whose bonus is NEGATIVE (center is multiplied by -1): Weapon Recoil. */
  invertedStats: string[];
  /** Stats that can't roll as a negative. */
  noNegative: string[];
  /** Weapon name (as the calculator lists it) -> category index; `bow` = fire rate is doubled on bows. */
  weapons: { name: string; category: number; bow?: boolean }[];
  /** WFM riven attribute slug -> Codex stat name (data/codex-stat-map.json). */
  statSlugs: Record<string, string>;
}

export interface CodexStat {
  name: string;
  unit: "%" | "x" | "s" | "m" | "";
  /** Raw table values per category (before the disposition factor); null = this stat doesn't exist for that category. */
  base: (number | null)[];
}

export interface CodexLayout {
  id: string; // "3/1"
  positives: number;
  negatives: number;
  /** Multiplier applied to every positive stat. */
  positiveMultiplier: number;
  /** Multiplier for the negative stat (0 when there is none). */
  negativeMultiplier: number;
}

export interface CodexGradeBand {
  grade: string; // S, A+, A, A-, B+, B, B-, C+, C, C-, F
  /** Deviation from the center, in percent (-10 .. 10). */
  lower: number;
  upper: number;
}
