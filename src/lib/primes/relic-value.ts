import type { Relic } from "./types";

/**
 * Relic refinement odds (percent). Every relic drops 3 commons, 2 uncommons and 1 rare; refining shifts the odds towards
 * the rarer drops. Source: the Warframe Wiki's "Void Relic" page (Drop Chances). Items in a rarity are equally likely.
 */
export const REFINEMENTS = [
  { id: "intact", label: "Intact", traces: 0, common: 76, uncommon: 22, rare: 2 },
  { id: "exceptional", label: "Exceptional", traces: 25, common: 70, uncommon: 26, rare: 4 },
  { id: "flawless", label: "Flawless", traces: 50, common: 60, uncommon: 34, rare: 6 },
  { id: "radiant", label: "Radiant", traces: 100, common: 50, uncommon: 40, rare: 10 },
] as const;
export type RefinementId = (typeof REFINEMENTS)[number]["id"];

export interface RelicDrop { slug: string | null; rarity: "common" | "uncommon" | "rare"; price: number | null }

export interface RelicValue {
  /** Expected platinum from ONE reward pick of this relic, per refinement. */
  ev: Record<RefinementId, number>;
  drops: RelicDrop[];
  /** Drops that are tradable but had no price (they count as 0 in the expected value, so it is a lower bound). */
  unpriced: number;
}

/** Expected platinum per run for each refinement. `priceOf` returns a slug's price, or null if unknown. Forma (untradable) counts as 0. */
export function relicValue(relic: Pick<Relic, "common" | "uncommon" | "rare">, priceOf: (slug: string) => number | null): RelicValue {
  const price = (slug: string | null) => (slug == null ? 0 : priceOf(slug));
  const drops: RelicDrop[] = [
    ...relic.common.map((slug): RelicDrop => ({ slug, rarity: "common", price: slug == null ? 0 : priceOf(slug) })),
    ...relic.uncommon.map((slug): RelicDrop => ({ slug, rarity: "uncommon", price: slug == null ? 0 : priceOf(slug) })),
    { slug: relic.rare, rarity: "rare", price: price(relic.rare) },
  ];
  const sum = (xs: (string | null)[]) => xs.reduce((s, x) => s + (price(x) ?? 0), 0);
  const c = sum(relic.common) / relic.common.length, u = sum(relic.uncommon) / relic.uncommon.length, r = price(relic.rare) ?? 0;
  const ev = Object.fromEntries(REFINEMENTS.map((f) => [f.id, Math.round(((f.common / 100) * c + (f.uncommon / 100) * u + (f.rare / 100) * r) * 10) / 10])) as Record<RefinementId, number>;
  return { ev, drops, unpriced: drops.filter((d) => d.slug != null && d.price == null).length };
}
