import type { CollectionRarity } from "./collections";

export interface ArcanePrice {
  /** The unranked price used (rank-0 average, or the derived max-rank ÷ copies price). */
  avg5: number | null;
  low: number | null;
  /** Rank-0 listings behind it. */
  listings?: number;
  /** Where the price came from; "thin" = shaky, "derived" = max-rank price ÷ copies. */
  basis?: "listings" | "derived" | "thin" | "none";
}

export interface ValuedCollectionInput {
  picks: number;
  tiers: { rarity: CollectionRarity; chance: number; arcanes: string[] }[]; // arcane slugs
}

export interface ValuedTier {
  rarity: CollectionRarity;
  chance: number;
  total: number;
  priced: number;
  /** Mean price of the tier's priced arcanes. */
  avg: number | null;
  arcanes: { slug: string; avg5: number | null; low: number | null; /** Listings behind avg5 (0–5). */ listings: number; basis: "listings" | "derived" | "thin" | "none"; /** Share of the collection's expected value this arcane carries (0…1). */ share: number }[];
}

export interface CollectionValue {
  /** The headline number: the average of every arcane's price in the collection, ignoring rarity odds. */
  avgPerArcane: number | null;
  /** Expected price of ONE pick, weighting rarities by their drop chance (each arcane in a rarity equally likely). */
  oddsPerArcane: number | null;
  /** What one purchase is worth on average: picks × oddsPerArcane. */
  perPack: number | null;
  priced: number;
  total: number;
  /** Arcanes with no price are left out of every average; confidence falls with how many that is. */
  confidence: "high" | "medium" | "low";
  tiers: ValuedTier[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

/** Value one Arcane Collection from current arcane prices. Pure. */
export function valueCollection(c: ValuedCollectionInput, price: (slug: string) => ArcanePrice | undefined): CollectionValue {
  const allPrices: number[] = [];
  const tiers = c.tiers.filter((t) => t.chance > 0).map((t) => {
    const priced = t.arcanes.flatMap((slug) => { const p = price(slug)?.avg5; return p == null ? [] : [{ slug, p }]; });
    allPrices.push(...priced.map((x) => x.p));
    return { t, priced, avg: mean(priced.map((x) => x.p)) };
  });

  // odds-weighted expectation, renormalised over the rarities that have at least one priced arcane
  const usable = tiers.filter((x) => x.avg != null);
  const mass = usable.reduce((s, x) => s + x.t.chance, 0);
  const odds = mass > 0 ? usable.reduce((s, x) => s + x.t.chance * (x.avg as number), 0) / mass : null;

  const total = tiers.reduce((s, x) => s + x.t.arcanes.length, 0);
  const coverage = total ? allPrices.length / total : 0;

  return {
    avgPerArcane: r1(mean(allPrices)),
    oddsPerArcane: r1(odds),
    perPack: odds == null ? null : r1(odds * c.picks),
    priced: allPrices.length,
    total,
    confidence: coverage >= 0.9 ? "high" : coverage >= 0.7 ? "medium" : "low",
    tiers: tiers.map((x): ValuedTier => ({
      rarity: x.t.rarity, chance: x.t.chance, total: x.t.arcanes.length, priced: x.priced.length, avg: r1(x.avg),
      arcanes: x.t.arcanes
        .map((slug) => {
          const p = price(slug);
          const share = odds && x.avg != null && p?.avg5 != null && mass > 0 ? (x.t.chance / mass) * (p.avg5 / Math.max(1, x.priced.length)) / odds : 0;
          return { slug, avg5: p?.avg5 ?? null, low: p?.low ?? null, listings: p?.listings ?? 0, basis: p?.basis ?? "none", share };
        })
        .sort((a, b) => (b.avg5 ?? -1) - (a.avg5 ?? -1)),
    })),
  };
}
