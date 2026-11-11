import { describe, expect, it } from "vitest";
import { copiesForRank, effectivePrice } from "./effective-price";

const P = (avg5: number | null, listings: number, maxLow: number | null) => ({ avg5, listings, maxLow });

describe("copiesForRank", () => {
  it("is the triangular numbers the wiki lists: 1, 3, 6, 10, 15, 21", () => expect([0, 1, 2, 3, 4, 5].map(copiesForRank)).toEqual([1, 3, 6, 10, 15, 21]));
});

describe("effectivePrice", () => {
  it("5 rank-0 listings → their average, whatever the max-rank price is", () => {
    expect(effectivePrice(P(8, 5, 120), 5)).toEqual({ price: 8, basis: "listings" });
    expect(effectivePrice(P(100, 5, 60), 5)).toEqual({ price: 100, basis: "listings" }); // no cross-checking: the rule is just "average of the bottom 5"
  });

  it("fewer than 5 rank-0 listings → cheapest max-rank listing ÷ 21 (60 ÷ 21 = 2.9)", () => {
    const e = effectivePrice(P(100, 1, 60), 5);
    expect(e).toMatchObject({ price: 2.9, basis: "derived", why: "fewer than 5 listings", derivation: { maxPrice: 60, copies: 21 } });
    expect(effectivePrice(P(9, 4, 42), 5).price).toBe(2);
  });

  it("no rank-0 listings at all → derived", () => expect(effectivePrice(P(null, 0, 42), 5)).toMatchObject({ basis: "derived", price: 2, why: "no listings" }));

  it("a rank-3-max arcane divides by 10 copies, not 21", () => expect(effectivePrice(P(100, 2, 60), 3).price).toBe(6));

  it("uses the CHEAPEST max-rank listing, not an average of them", () => expect(effectivePrice(P(null, 0, 21), 5).price).toBe(1));

  it("no max-rank listing → the few rank-0 listings are shown, flagged thin", () => {
    expect(effectivePrice(P(100, 1, null), 5)).toEqual({ price: 100, basis: "thin" });
    expect(effectivePrice(P(100, 3, null), 5)).toEqual({ price: 100, basis: "thin" });
  });

  it("nothing anywhere → no price; and an arcane with no max rank can't be derived", () => {
    expect(effectivePrice(P(null, 0, null), 5)).toEqual({ price: null, basis: "none" });
    expect(effectivePrice(P(9, 1, 50), null).basis).toBe("thin");
  });
});
