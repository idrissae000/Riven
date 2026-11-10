/**
 * The browse.wf Riven Calculator's reference data (https://browse.wf/rivencalc), produced by
 * `npm run sync:rivencalc` and committed as data/rivencalc.json.
 *
 * The calculator derives every range from the game's own export data with a small formula (RivenParser.js):
 *   attenuation = 1.5 × disposition × 10
 *   buff  = base(tag, category) × attenuation × 1.25^curses × buffCountAtten[buffs] × (rank + 1) × roll
 *   curse = −base(tag, category) × attenuation × curseBuffCountAtten[buffs] × buffCountAtten[curses] × (rank + 1) × roll
 *   roll  = 0.9 … 1.1
 * The sync script confirms that formula in the source text and then tabulates the result, so `ranges` holds the full
 * min–max for every stat, in every category and layout, as the page lists them (disposition locked to 1.2, max rank).
 */
export interface RivenCalcData {
  source: {
    /** The calculator page. */
    url: string;
    parserUrl: string;
    upgradesUrl: string;
    weaponsUrl: string;
    dictUrl: string;
    /** sha256 of each source file the data was built from, to detect changes cheaply. */
    sha256: { page: string; parser: string; upgrades: string; weapons: string; dict: string };
    fetchedAt: string;
  };
  /** The weapon disposition (page: "omega attenuation") every range was computed at. Locked on purpose. */
  disposition: number;
  /** Rank the ranges are for (the page's maximum). */
  rank: number;
  /** The random roll multiplier: value = center × (min … max). Read from the calculator code. */
  roll: { min: number; max: number };
  /** The calculator's grade table: bounds are the roll's deviation from its center, in percent. */
  gradeBands: GradeBand[];
  /** The calculator marks a roll further than this (in percent) from the center as impossible ("X"). */
  outOfRangeDeviation: number;
  /** How curses are graded: "inverted" = the calculator grades 1 − f, so the mildest penalty is the best grade. */
  curseGrading: "inverted" | "same";
  /** In the calculator's order (the page's weapon-type dropdown). */
  categories: { id: string; name: string }[];
  layouts: { id: string; buffs: number; curses: number }[];
  /** Every stat (game tag) the calculator knows, with how its numbers are expressed. */
  stats: StatDef[];
  /**
   * ranges[categoryId][layoutId] = { buffs: { tag: [atRoll0.9, atRoll1.1] }, curses: { ... } }
   * Values are in the units a player sees (percent as e.g. 185.6, "x" stats as e.g. 1.41), signed.
   */
  ranges: Record<string, Record<string, LayoutRanges>>;
  /** Weapon name (as the calculator lists it) → category id. */
  weapons: { name: string; category: string }[];
  /** Warframe Market riven attribute slug → the calculator's stat tag(s); a slug can map to a ranged and a melee tag. */
  statSlugs: Record<string, string[]>;
}

export interface LayoutRanges {
  buffs: Record<string, [number, number]>;
  curses: Record<string, [number, number]>;
}

export interface StatDef {
  tag: string;
  /** English name, e.g. "Critical Chance". */
  name: string;
  /** How a player sees the number: "percent" (+185.6%), "multiply" (x1.41), "seconds", "" (plain number). */
  unit: "percent" | "multiply" | "seconds" | "";
}

export interface GradeBand {
  grade: string; // S, A+, A, A-, B+, B, B-, C+, C, C-, F
  /** Deviation from the center, in percent. The lowest band's lower bound is the bottom of the roll range (-10). */
  lower: number;
  upper: number;
}
