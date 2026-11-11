import { describe, expect, it } from "vitest";
import type { Listing } from "./comparables";
import { VALUATION, valuate, weightedQuantile } from "./valuation";

const NOW = Date.parse("2026-11-10T00:00:00Z");
let n = 0;
const L = (price: number, extra: Partial<Listing> = {}): Listing => ({
  id: `a${n++}`, url: "", seller: `seller${n}`, sellerUrl: "", sellerStatus: "ingame", price, postedAt: "2026-11-09T00:00:00Z", rivenName: "", rank: 8, rerolls: 5, polarity: "madurai",
  masteryRank: 12, stats: [], matchKind: "exact", matched: 3, total: 3, score: 1, ...extra,
});
const many = (prices: number[], extra: Partial<Listing> = {}) => prices.map((p) => L(p, extra));

describe("weightedQuantile", () => {
  it("equal weights give the usual percentile", () => {
    const v = [100, 200, 300, 400, 500], w = [1, 1, 1, 1, 1];
    expect(weightedQuantile(v, w, 0.5)).toBe(300);
    expect(weightedQuantile(v, w, 0.25)).toBeCloseTo(175); // mid-weight positions: 0.1, 0.3, 0.5, 0.7, 0.9
    expect(weightedQuantile(v, w, 0.75)).toBeCloseTo(425);
    expect(weightedQuantile(v, w, 0)).toBe(100);
    expect(weightedQuantile(v, w, 1)).toBe(500);
  });
  it("heavier listings pull the quantile", () => expect(weightedQuantile([10, 20, 30], [1, 1, 8], 0.5)).toBeGreaterThan(25));
  it("handles a single value and unsorted input", () => {
    expect(weightedQuantile([42], [1], 0.5)).toBe(42);
    expect(weightedQuantile([30, 10, 20], [1, 1, 1], 0.5)).toBe(20);
  });
});

describe("valuate", () => {
  it("never produces an estimate without enough listings behind it", () => {
    expect(valuate([], null, NOW).estimate).toBeNull();
    expect(valuate(many([100, 120]), null, NOW).estimate).toBeNull();
    expect(valuate(many([100, 120]), null, NOW).listings).toHaveLength(2); // still cited
  });

  it("is robust: troll asks at either end don't move the estimate", () => {
    const clean = valuate(many([90, 95, 100, 100, 105, 110, 120]), null, NOW).estimate!;
    const noisy = valuate([...many([90, 95, 100, 100, 105, 110, 120]), ...many([1, 99999, 123456])], null, NOW);
    expect(noisy.estimate!.median).toBeCloseTo(clean.median, -1);
    expect(noisy.estimate!.high).toBeLessThan(200);
    expect(noisy.estimate!.low).toBeGreaterThan(60);
    expect(noisy.estimate!.outliers).toBe(3);
    expect(noisy.listings.filter((l) => l.outlier).map((l) => l.price).sort((a, b) => a - b)).toEqual([1, 99999, 123456]);
    expect(noisy.listings.find((l) => l.price === 99999)!.weight).toBe(0);
  });

  it("doesn't call a normal spread of asks outliers", () => {
    const e = valuate(many([80, 100, 120, 150, 90, 110]), null, NOW).estimate!;
    expect(e.outliers).toBe(0);
    expect(e.low).toBeLessThan(e.median);
    expect(e.median).toBeLessThan(e.high);
  });

  it("adjusts for roll quality: better rolls than the comparables are worth more, worse rolls less", () => {
    const comps = many([100, 100, 110, 110, 120], { quality: 0.5 });
    const same = valuate(comps, 0.5, NOW).estimate!;
    const better = valuate(comps, 0.9, NOW).estimate!;
    const worse = valuate(comps, 0.1, NOW).estimate!;
    expect(better.median).toBeGreaterThan(same.median);
    expect(worse.median).toBeLessThan(same.median);
    expect(better.adjusted && worse.adjusted).toBe(true);
    expect(same.adjusted).toBe(false);
    // capped: a huge quality gap can't more than ×1.42 a price
    expect(valuate(many([100, 100, 100, 100], { quality: 0 }), 1, NOW).estimate!.median).toBeLessThanOrEqual(143);
  });

  it("makes no adjustment when quality is unknown", () => {
    const e = valuate(many([100, 100, 100, 100], { quality: null }), 0.9, NOW).estimate!;
    expect(e.median).toBe(100);
    expect(e.adjusted).toBe(false);
  });

  it("prefers exact-stat listings when there are enough, and says which basis it used", () => {
    const e = valuate([...many([100, 100, 100], { matchKind: "exact" }), ...many([300, 300, 300], { matchKind: "similar", matched: 2 })], null, NOW);
    expect(e.estimate!.basis).toBe("exact");
    expect(e.estimate!.median).toBe(100);
    expect(e.listings).toHaveLength(3);
    const sim = valuate([...many([100], { matchKind: "exact" }), ...many([110, 120, 130], { matchKind: "similar", matched: 2 })], null, NOW).estimate!;
    expect(sim.basis).toBe("similar");
  });

  it("one seller flooding the pool counts once, not many times", () => {
    const flood = Array.from({ length: 6 }, () => L(500, { seller: "spammer" }));
    const e = valuate([...flood, ...many([100, 105, 110, 115])], null, NOW).estimate!;
    expect(e.median).toBeLessThan(200);
  });

  it("fresher, in-game sellers count for more than stale offline ones", () => {
    const fresh = valuate([...many([100, 100, 100, 100], { sellerStatus: "ingame" }), ...many([180, 180, 180, 180], { sellerStatus: "offline", postedAt: "2026-06-01T00:00:00Z" })], null, NOW).estimate!;
    const flat = valuate([...many([100, 100, 100, 100]), ...many([180, 180, 180, 180])], null, NOW).estimate!;
    expect(fresh.median).toBeLessThan(flat.median);
  });

  it("confidence reflects sample size and agreement", () => {
    expect(valuate(many([100, 101, 99, 100, 102, 98, 100, 101, 99, 100]), null, NOW).estimate!.confidence).toBe("high");
    expect(valuate(many([100, 130, 80]), null, NOW).estimate!.confidence).toBe("low");
  });

  it("still estimates when trolls leave exactly the minimum, and cites the dropped ones", () => {
    const v = valuate(many([1, 100, 110, 115, 999999]), null, NOW);
    expect(v.estimate).toMatchObject({ sampleSize: 3, outliers: 2 });
    expect(v.listings).toHaveLength(5);
  });

  it("keeps the knobs in one place", () => { expect(VALUATION.MIN_SAMPLES).toBe(3); expect(VALUATION.OUTLIER_Z).toBeGreaterThan(2); });
});
