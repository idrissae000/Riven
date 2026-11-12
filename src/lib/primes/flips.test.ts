import { describe, expect, it } from "vitest";
import { ducatVerdict } from "./ducats";
import { findFlips } from "./flips";
import type { PrimePart } from "./types";

const P = (slug: string, kind: "part" | "set", perSet = 1, setSlug: string | null = "x_prime_set"): PrimePart =>
  ({ slug, name: slug, kind, type: "primary", ducats: null, setSlug: kind === "set" ? null : setSlug, perSet, relics: [], vaulted: null });
const parts = [P("x_prime_set", "set"), P("x_barrel", "part", 2), P("x_stock", "part"), P("y_prime_set", "set"), P("y_a", "part", 1, "y_prime_set")];
const prices: Record<string, [number, number]> = { x_prime_set: [100, 5], x_barrel: [20, 5], x_stock: [30, 5], y_prime_set: [50, 5], y_a: [60, 5] };
const info = (s: string) => (prices[s] ? { price: prices[s][0], listings: prices[s][1] } : undefined);

describe("findFlips", () => {
  it("finds sets worth more than their parts, counting duplicate parts", () => {
    const f = findFlips(parts, info);
    expect(f).toHaveLength(1); // y loses money (parts 60 > set 50)
    expect(f[0]).toMatchObject({ setSlug: "x_prime_set", partsCost: 70, profit: 30, roi: 43, thin: false });
    expect(f[0].parts).toEqual([expect.objectContaining({ slug: "x_barrel", qty: 2 }), expect.objectContaining({ slug: "x_stock", qty: 1 })]);
  });
  it("skips sets with any unpriced part and flags thin markets", () => {
    expect(findFlips(parts, (s) => (s === "x_stock" ? undefined : info(s)))).toHaveLength(0);
    prices.x_stock = [30, 2];
    expect(findFlips(parts, info)[0].thin).toBe(true);
  });
});

describe("ducatVerdict", () => {
  it("ducats the cheap parts, sells the rest", () => {
    expect(ducatVerdict(3, 45)).toBe("ducat");
    expect(ducatVerdict(4.5, 45)).toBe("ducat");
    expect(ducatVerdict(10, 45)).toBe("sell");
    expect(ducatVerdict(null, 45)).toBeNull();
    expect(ducatVerdict(5, null)).toBeNull();
  });
});
