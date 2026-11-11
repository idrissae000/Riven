/** The prime-part and relic catalogue (data/primes.json), built by `npm run sync:primes` from Warframe Market's item list and the game's export data. */
export type PartType = "warframe" | "primary" | "secondary" | "melee" | "archwing" | "companion" | "other";
export type DropRarity = "common" | "uncommon" | "rare";

export interface PrimePart {
  slug: string;
  name: string;
  /** "part" = a part or blueprint; "set" = the full set. */
  kind: "part" | "set";
  type: PartType;
  ducats: number | null;
  /** The set this part belongs to (its slug), when it has one. */
  setSlug: string | null;
  /** How many of this part the set needs (most need 1; some, like Akbolto Prime's barrel, need 2). */
  perSet: number;
  /** Relics (ids) that drop it. Empty = not a relic drop (Baro Ki'Teer, a Prime Access exclusive, …). */
  relics: string[];
  /** true = every relic that drops it is vaulted; false = at least one is in the drop tables; null = not a relic drop / a set. */
  vaulted: boolean | null;
}

export interface Relic {
  /** "lith_h2" */
  id: string;
  era: "Lith" | "Meso" | "Neo" | "Axi";
  /** "Lith H2" */
  name: string;
  vaulted: boolean;
  /** What it drops, as Warframe Market slugs; null = can't be traded (Forma Blueprint). Always 3 common, 2 uncommon, 1 rare. */
  common: (string | null)[];
  uncommon: (string | null)[];
  rare: string | null;
}

export interface PrimeCatalogue {
  source: { itemsUrl: string; relicsUrl: string; rewardsUrl: string; sha256: { items: string; relics: string; rewards: string }; fetchedAt: string };
  parts: PrimePart[];
  relics: Relic[];
}
