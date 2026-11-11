import { describe, expect, it } from "vitest";
import { inventoryInputSchema, inventoryQtySchema } from "./schema";

describe("inventory schemas", () => {
  it("accepts a Prime part and defaults the rank to 0", () => expect(inventoryInputSchema.parse({ kind: "prime", slug: "lex_prime_barrel", qty: 3 })).toEqual({ kind: "prime", slug: "lex_prime_barrel", rank: 0, qty: 3 }));
  it("accepts an arcane at max rank", () => expect(inventoryInputSchema.safeParse({ kind: "arcane", slug: "arcane_energize", rank: 5, qty: 1 }).success).toBe(true));
  it("rejects bad quantities, kinds and ranks", () => {
    expect(inventoryInputSchema.safeParse({ kind: "prime", slug: "x", qty: 0 }).success).toBe(false);
    expect(inventoryInputSchema.safeParse({ kind: "prime", slug: "x", qty: 1.5 }).success).toBe(false);
    expect(inventoryInputSchema.safeParse({ kind: "mod", slug: "x", qty: 1 }).success).toBe(false);
    expect(inventoryInputSchema.safeParse({ kind: "arcane", slug: "x", rank: 11, qty: 1 }).success).toBe(false);
    expect(inventoryInputSchema.safeParse({ kind: "prime", slug: "", qty: 1 }).success).toBe(false);
  });
  it("qty-only updates", () => { expect(inventoryQtySchema.safeParse({ qty: 7 }).success).toBe(true); expect(inventoryQtySchema.safeParse({ qty: -1 }).success).toBe(false); });
});
