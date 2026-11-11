import { describe, expect, it } from "vitest";
import { copiesForRank, effectivePrice } from "./effective-price";

const P = (avg5: number | null, listings: number, maxAvg5: number | null, maxListings: number) => ({ avg5, listings, maxAvg5, maxListings });

describe("copiesForRank", () => {
  it("is the triangular numbers the wiki lists: 1, 3, 6, 10, 15, 21", () => expect([0, 1, 2, 3, 4, 5].map(copiesForRank)).toEqual([1, 3, 6, 10, 15, 21]));
});

describe("effectivePrice", () => {
  it("trusts the rank-0 listings when there are enough of them", () => expect(effectivePrice(P(8, 5, 120, 5), 5)).toEqual({ price: 8, basis: "listings" }));

  it("thin rank-0 market → max-rank price ÷ 21 (the user's rule: 60 ÷ 21)", () => {
    const e = effectivePrice(P(100, 1, 60, 5), 5);
    expect(e.basis).toBe("derived");
    expect(e.price).toBe(2.9); // 60 / 21
    expect(e.why).toBe("too few listings");
    expect(e.derivation).toEqual({ maxPrice: 60, copies: 21 });
  });

  it("a rank-3-max arcane divides by 10 copies, not 21", () => expect(effectivePrice(P(100, 1, 81.6, 5), 3).price).toBe(8.2));

  it("no rank-0 listings at all → derived", () => {
    const e = effectivePrice(P(null, 0, 42, 4), 5);
    expect(e).toMatchObject({ basis: "derived", price: 2, why: "no listings" });
  });

  it("rank-0 priced at or above the max-rank price is impossible → derived", () => {
    const e = effectivePrice(P(100, 5, 60, 5), 5);
    expect(e).toMatchObject({ basis: "derived", price: 2.9, why: "priced above max rank" });
  });

  it("does not derive from a thin max-rank market either; the thin rank-0 ask is kept but flagged", () => {
    expect(effectivePrice(P(100, 1, 60, 2), 5)).toEqual({ price: 100, basis: "thin" });
    expect(effectivePrice(P(100, 1, null, 0), 5)).toEqual({ price: 100, basis: "thin" });
  });

  it("nothing anywhere → no price", () => expect(effectivePrice(P(null, 0, null, 0), 5)).toEqual({ price: null, basis: "none" }));

  it("an arcane with no max rank can't be derived", () => expect(effectivePrice(P(9, 1, 50, 5), null).basis).toBe("thin"));
});
