import { describe, expect, it } from "vitest";
import { askBaseline, findDeals, reboundStats, type Level } from "./deals";
import type { PrimePart } from "./types";

const part = (slug: string): PrimePart => ({ slug, name: slug.toUpperCase(), kind: "part", type: "other", ducats: null, setSlug: null, perSet: 1, relics: [], vaulted: null });
const lv = (slug: string, typical: number, extra: Partial<Level> = {}): Level => ({ slug, typical, recent: typical, prev: typical, per_day: 8, days: 30, ...extra });

describe("findDeals", () => {
  // 40 ordinary items that ask 5% above their usual price, so the baseline is 1.05
  const base = Array.from({ length: 40 }, (_, i) => lv(`n${i}`, 20));
  const ask = (m: Record<string, { avg5: number; listings: number }>) => (s: string) => (s.startsWith("n") ? { avg5: 21, listings: 6 } : m[s]);
  it("measures how asks usually sit against sold prices", () => {
    expect(askBaseline(base, ask({}))).toBeCloseTo(1.05);
  });
  it("finds a part priced well under its normal ask and flags one that is still sliding", () => {
    const levels = [...base, lv("deal", 40), lv("slide", 40, { recent: 30, prev: 40 }), lv("fair", 40), lv("slow", 40, { per_day: 1 }), lv("thin", 40)];
    const m = { deal: { avg5: 30, listings: 8 }, slide: { avg5: 30, listings: 8 }, fair: { avg5: 41, listings: 8 }, slow: { avg5: 20, listings: 8 }, thin: { avg5: 10, listings: 2 } };
    const { deals } = findDeals(levels, ["deal", "slide", "fair", "slow", "thin"].map(part), ask(m));
    expect(deals.map((d) => d.slug)).toEqual(["deal", "slide"]);
    expect(deals[0]).toMatchObject({ normal: 42, discountPct: 28.6, gain: 12, falling: false });
    expect(deals[1].falling).toBe(true);
  });
});

describe("reboundStats", () => {
  const day = (i: number, avg: number) => ({ day: `d${i}`, avg, min: avg, max: avg, volume: 10 });
  it("counts a dip that recovered", () => {
    const rows = Array.from({ length: 60 }, (_, i) => day(i, i >= 33 && i <= 36 ? 40 : 50));
    expect(reboundStats(rows)).toEqual({ dips: 1, recovered: 1 });
  });
  it("counts a dip that did not", () => {
    const rows = Array.from({ length: 60 }, (_, i) => day(i, i >= 33 ? 40 : 50));
    expect(reboundStats(rows)).toEqual({ dips: 1, recovered: 0 });
  });
  it("has nothing to say about a short record", () => expect(reboundStats([day(1, 5)])).toEqual({ dips: 0, recovered: 0 }));
});
