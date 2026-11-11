import { describe, expect, it } from "vitest";
import { pickStale, reduceSold, reduceTopOrders, type TopOrder } from "./top-price";
import { valueCollection } from "./collection-value";

const o = (platinum: number, extra: Partial<TopOrder> = {}): TopOrder => ({ type: "sell", platinum, quantity: 1, rank: 0, visible: true, user: { status: "ingame", platform: "pc" }, ...extra });

describe("reduceTopOrders", () => {
  it("averages the five cheapest online rank-0 listings and reports the cheapest", () => {
    const r = reduceTopOrders([o(40), o(10), o(20), o(30), o(50), o(60), o(999)]);
    expect(r).toEqual({ low: 10, avg5: 30, listings: 5 }); // (10+20+30+40+50)/5
  });
  it("uses fewer when there aren't five, and says how many", () => expect(reduceTopOrders([o(10), o(20)])).toEqual({ low: 10, avg5: 15, listings: 2 }));
  it("ignores offline sellers, other ranks, hidden / empty orders and other platforms", () => {
    const r = reduceTopOrders([
      o(1, { user: { status: "offline", platform: "pc" } }), o(2, { rank: 5 }), o(3, { visible: false }), o(4, { quantity: 0 }),
      o(5, { user: { status: "ingame", platform: "xbox", crossplay: false } }), o(100), o(110, { user: { status: "online", platform: "xbox", crossplay: true } }),
    ]);
    expect(r).toEqual({ low: 100, avg5: 105, listings: 2 });
  });
  it("no listings → nulls", () => { expect(reduceTopOrders([])).toEqual({ low: null, avg5: null, listings: 0 }); expect(reduceTopOrders(null).avg5).toBeNull(); });
  it("rounds the average to one decimal", () => expect(reduceTopOrders([o(10), o(11), o(11)]).avg5).toBe(10.7));
});

describe("reduceSold", () => {
  it("sums rank-0 volume and weights the average price by it", () => {
    const r = reduceSold([{ mod_rank: 0, volume: 10, avg_price: 100 }, { mod_rank: 0, volume: 30, avg_price: 200 }, { mod_rank: 5, volume: 99, avg_price: 9999 }]);
    expect(r).toEqual({ volume48h: 40, soldAvg48h: 175 });
  });
  it("counts rank-less rows as rank 0 and returns null with nothing to count", () => {
    expect(reduceSold([{ volume: 4, avg_price: 50 }])).toEqual({ volume48h: 4, soldAvg48h: 50 });
    expect(reduceSold([])).toBeNull();
    expect(reduceSold([{ mod_rank: 5, volume: 3, avg_price: 1 }])).toBeNull();
  });
});

describe("pickStale", () => {
  const rows = [{ slug: "a", t: "2026-11-10T10:00:00Z" }, { slug: "b", t: null }, { slug: "c", t: "2026-11-10T11:50:00Z" }, { slug: "d", t: "2026-11-10T09:00:00Z" }];
  const now = Date.parse("2026-11-10T12:00:00Z");
  it("never-fetched first, then oldest, skipping fresh ones, up to the limit", () => {
    expect(pickStale(rows, (r) => r.t, now, 60 * 60_000, 10).map((r) => r.slug)).toEqual(["b", "d", "a"]);
    expect(pickStale(rows, (r) => r.t, now, 60 * 60_000, 2).map((r) => r.slug)).toEqual(["b", "d"]);
  });
  it("nothing to do when everything is fresh", () => expect(pickStale(rows, () => "2026-11-10T11:59:00Z", now, 60 * 60_000, 5)).toEqual([]));
});

describe("valueCollection", () => {
  const price = (m: Record<string, number | null>) => (slug: string) => (slug in m ? { avg5: m[slug], low: m[slug] } : undefined);
  const c = { picks: 3, tiers: [
    { rarity: "Common" as const, chance: 60, arcanes: ["c1", "c2"] },
    { rarity: "Rare" as const, chance: 40, arcanes: ["r1", "r2", "r3"] },
    { rarity: "Legendary" as const, chance: 0, arcanes: [] },
  ] };

  it("headline = plain average of every arcane's price in the collection, ignoring odds", () => {
    const v = valueCollection(c, price({ c1: 10, c2: 20, r1: 100, r2: 200, r3: 300 }));
    expect(v.avgPerArcane).toBe(126); // (10+20+100+200+300)/5
    expect(v.priced).toBe(5);
    expect(v.total).toBe(5);
    expect(v.confidence).toBe("high");
  });

  it("odds-weighted value uses the rarity chances (each arcane in a tier equally likely)", () => {
    const v = valueCollection(c, price({ c1: 10, c2: 20, r1: 100, r2: 200, r3: 300 }));
    expect(v.oddsPerArcane).toBe(89); // 0.6×15 + 0.4×200
    expect(v.perPack).toBe(267); // 3 picks
    expect(v.tiers.map((t) => [t.rarity, t.avg])).toEqual([["Common", 15], ["Rare", 200]]);
  });

  it("the two can rank collections differently — that's why both are shown", () => {
    const many = valueCollection({ picks: 3, tiers: [{ rarity: "Common", chance: 90, arcanes: ["x"] }, { rarity: "Rare", chance: 10, arcanes: ["y", "z", "w", "v", "u", "t", "s", "q", "p", "o"] }] }, price({ x: 5, y: 300, z: 300, w: 300, v: 300, u: 300, t: 300, s: 300, q: 300, p: 300, o: 300 }));
    expect(many.avgPerArcane).toBeGreaterThan(270); // looks great by plain average…
    expect(many.oddsPerArcane).toBeLessThan(40); // …but you mostly roll the 5p common
  });

  it("unpriced arcanes are left out and lower the confidence", () => {
    const v = valueCollection(c, price({ c1: 10, c2: null, r1: 100 }));
    expect(v.priced).toBe(2);
    expect(v.total).toBe(5);
    expect(v.avgPerArcane).toBe(55);
    expect(v.confidence).toBe("low");
  });

  it("a tier with no priced arcanes drops out and the odds renormalise over the rest", () => {
    const v = valueCollection(c, price({ r1: 100, r2: 200, r3: 300 }));
    expect(v.oddsPerArcane).toBe(200);
    expect(v.tiers.find((t) => t.rarity === "Common")!.avg).toBeNull();
  });

  it("no prices at all → no numbers, not zeros", () => {
    const v = valueCollection(c, () => undefined);
    expect([v.avgPerArcane, v.oddsPerArcane, v.perPack]).toEqual([null, null, null]);
  });

  it("shares of the expected value add up to 1 and order arcanes by price", () => {
    const v = valueCollection(c, price({ c1: 10, c2: 20, r1: 100, r2: 200, r3: 300 }));
    const all = v.tiers.flatMap((t) => t.arcanes);
    expect(all.reduce((s, a) => s + a.share, 0)).toBeCloseTo(1, 5);
    expect(v.tiers[1].arcanes.map((a) => a.slug)).toEqual(["r3", "r2", "r1"]);
  });
});
