import { describe, expect, it } from "vitest";
import { REFINEMENTS, relicValue } from "./relic-value";

const relic = { common: ["c1", "c2", "forma"] as (string | null)[], uncommon: ["u1", "u2"], rare: "r1" };
const prices: Record<string, number | null> = { c1: 3, c2: 6, u1: 10, u2: 20, r1: 100 };
const priceOf = (s: string) => (s in prices ? prices[s] : null);

describe("REFINEMENTS", () => {
  it("each refinement's tier odds add to 100% (3 commons, 2 uncommons, 1 rare)", () => { for (const f of REFINEMENTS) expect(f.common + f.uncommon + f.rare).toBe(100); });
});

describe("relicValue", () => {
  const r = relicValue({ ...relic, common: ["c1", "c2", null] }, priceOf);
  it("intact: 76% a common (avg of 3, Forma = 0), 22% an uncommon (avg 15), 2% the rare", () => {
    // commons avg (3+6+0)/3 = 3 → 0.76×3 = 2.28 ; uncommons avg 15 → 0.22×15 = 3.3 ; rare 100 → 0.02×100 = 2   ⇒ 7.58
    expect(r.ev.intact).toBeCloseTo(7.6, 1);
  });
  it("radiant: 50% common, 40% uncommon, 10% rare", () => expect(r.ev.radiant).toBeCloseTo(0.5 * 3 + 0.4 * 15 + 0.1 * 100, 1)); // 17.5
  it("refining raises the expected value when the rare is worth the most", () => {
    expect(r.ev.intact).toBeLessThan(r.ev.exceptional);
    expect(r.ev.exceptional).toBeLessThan(r.ev.flawless);
    expect(r.ev.flawless).toBeLessThan(r.ev.radiant);
  });
  it("lists the six drops with their prices", () => {
    expect(r.drops).toHaveLength(6);
    expect(r.drops[5]).toEqual({ slug: "r1", rarity: "rare", price: 100 });
    expect(r.drops[2]).toEqual({ slug: null, rarity: "common", price: 0 });
  });
  it("a tradable drop with no price counts as 0 and is flagged (a lower bound)", () => {
    const x = relicValue({ ...relic, common: ["c1", "c2", "nope"] }, priceOf);
    expect(x.unpriced).toBe(1);
    expect(x.ev.intact).toBeCloseTo(7.6, 1);
    expect(r.unpriced).toBe(0);
  });
});
