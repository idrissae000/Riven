import { describe, expect, it } from "vitest";
import { planSets } from "./set-plan";
import type { PrimePart } from "./types";

const part = (slug: string, name: string, over: Partial<PrimePart>): PrimePart => ({ slug, name, kind: "part", type: "warframe", ducats: null, setSlug: "x_set", perSet: 1, relics: [], vaulted: null, ...over });
const parts = [part("x_set", "X Prime Set", { kind: "set", setSlug: null }), part("x_a", "X Prime A", {}), part("x_b", "X Prime B", {}), part("x_c", "X Prime C", { perSet: 2 })];
const prices: Record<string, { price: number; listings: number }> = { x_set: { price: 100, listings: 8 }, x_a: { price: 10, listings: 8 }, x_b: { price: 20, listings: 8 }, x_c: { price: 15, listings: 8 } };
const info = (s: string) => prices[s];

describe("planSets", () => {
  it("costs out finishing a set you partly hold", () => {
    const [p] = planSets(new Map([["x_a", 1], ["x_c", 1]]), parts, info);
    expect(p.missing.map((m) => [m.slug, m.qty])).toEqual([["x_b", 1], ["x_c", 1]]);
    expect(p.missingCost).toBe(35);
    expect(p.ownedValue).toBe(25);
    expect(p.gain).toBe(40); // 100 − 35 − 25
    expect(p.trades).toBe(2);
    expect(p.completePct).toBe(50);
    expect(p.complete).toBe(false);
  });
  it("recognises a finished set and skips sets you hold nothing of or can't price", () => {
    const done = planSets(new Map([["x_a", 1], ["x_b", 1], ["x_c", 2]]), parts, info);
    expect(done[0]).toMatchObject({ complete: true, missingCost: 0, gain: 100 - 60 });
    expect(planSets(new Map(), parts, info)).toEqual([]);
    expect(planSets(new Map([["x_a", 1]]), parts, (s) => (s === "x_b" ? undefined : prices[s]))).toEqual([]);
  });
  it("flags thin markets", () => {
    const thin = (s: string) => (s === "x_b" ? { price: 20, listings: 1 } : prices[s]);
    expect(planSets(new Map([["x_a", 1]]), parts, thin)[0].thin).toBe(true);
  });
});
