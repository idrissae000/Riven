import { describe, expect, it } from "vitest";
import type { PrimePart } from "@/lib/primes/types";
import { setAdvice, valueInventory, type OwnedItem } from "./value";

const own = (slug: string, qty: number, kind: "prime" | "arcane" = "prime", rank = 0): OwnedItem => ({ id: `${slug}${rank}`, kind, slug, rank, qty });

describe("valueInventory", () => {
  const info = (i: OwnedItem) => ({ a: { name: "A", price: 10, ducats: 45 }, b: { name: "B", price: 2.5, ducats: 15 }, c: { name: "C", price: null, ducats: null } } as Record<string, { name: string; price: number | null; ducats: number | null }>)[i.slug];
  const v = valueInventory([own("b", 4), own("a", 2), own("c", 1), own("zzz", 1)], info);
  it("totals quantity × price and sorts the best sells first", () => {
    expect(v.total).toBe(30); // 2×10 + 4×2.5
    expect(v.rows.map((r) => r.slug)).toEqual(["a", "b", "c", "zzz"]);
    expect(v.rows[0]).toMatchObject({ unit: 10, total: 20, ducatsTotal: 90, ducatsPerPlat: 4.5 });
  });
  it("keeps unpriced items but doesn't count them", () => {
    expect(v).toMatchObject({ priced: 2, count: 4 });
    expect(v.rows[2]).toMatchObject({ unit: null, total: null });
    expect(v.rows[3].name).toBe("zzz"); // unknown slug falls back to the slug
  });
});

describe("setAdvice", () => {
  const P = (slug: string, perSet = 1, kind: "part" | "set" = "part", setSlug: string | null = "x_prime_set"): PrimePart =>
    ({ slug, name: slug.replace(/_/g, " "), kind, type: "primary", ducats: null, setSlug: kind === "set" ? null : setSlug, perSet, relics: [], vaulted: null });
  const parts = [P("x_prime_set", 1, "set"), P("x_prime_barrel", 2), P("x_prime_blueprint"), P("x_prime_receiver")];
  const prices: Record<string, number> = { x_prime_set: 100, x_prime_barrel: 20, x_prime_blueprint: 10, x_prime_receiver: 30 }; // parts: 2×20 + 10 + 30 = 80
  const priceOf = (s: string) => prices[s] ?? null;

  it("a complete set (counting the 2 barrels) sells for more as a set when the set price beats the parts", () => {
    const a = setAdvice(new Map([["x_prime_barrel", 2], ["x_prime_blueprint", 1], ["x_prime_receiver", 1]]), parts, priceOf);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: "complete", count: 1, setPrice: 100, partsValue: 80, gain: 20 });
  });
  it("counts how many sets you can make", () => {
    const a = setAdvice(new Map([["x_prime_barrel", 5], ["x_prime_blueprint", 3], ["x_prime_receiver", 2]]), parts, priceOf);
    expect(a[0]).toMatchObject({ kind: "complete", count: 2, gain: 40 });
  });
  it("one barrel is not enough: the set needs two", () => {
    const a = setAdvice(new Map([["x_prime_barrel", 1], ["x_prime_blueprint", 1], ["x_prime_receiver", 1]]), parts, priceOf);
    expect(a[0]).toMatchObject({ kind: "nearly", missing: [{ slug: "x_prime_barrel", qty: 1, price: 20 }], missingCost: 20 });
    // buy 1 barrel (20), sell the set (100) vs sell what you have (20+10+30 = 60): +20
    expect(a[0].gain).toBe(20);
  });
  it("no advice when buying the missing part wouldn't pay", () => {
    const cheapSet = { ...prices, x_prime_set: 70 };
    expect(setAdvice(new Map([["x_prime_barrel", 1], ["x_prime_blueprint", 1], ["x_prime_receiver", 1]]), parts, (s) => cheapSet[s as keyof typeof cheapSet] ?? null)).toEqual([]);
  });
  it("says a complete set is better sold as parts when the set price is lower", () => {
    const a = setAdvice(new Map([["x_prime_barrel", 2], ["x_prime_blueprint", 1], ["x_prime_receiver", 1]]), parts, (s) => ({ ...prices, x_prime_set: 60 })[s as keyof typeof prices] ?? null);
    expect(a[0].gain).toBe(-20);
  });
  it("skips sets when any price is missing, or when you own none of the parts", () => {
    expect(setAdvice(new Map([["x_prime_barrel", 2]]), parts, (s) => (s === "x_prime_receiver" ? null : priceOf(s)))).toEqual([]);
    expect(setAdvice(new Map(), parts, priceOf)).toEqual([]);
  });
  it("skips a set that is missing two or more different parts", () => expect(setAdvice(new Map([["x_prime_blueprint", 1]]), parts, priceOf)).toEqual([]));
});
