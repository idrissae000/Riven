import { describe, expect, it } from "vitest";
import type { Listing } from "./listings";
import { repriceSellOrder, repricedValue } from "./reprice";

const L = (platinum: number, seller: string): Listing => ({ platinum, seller, quantity: 1, status: "ingame" });
const market = [L(8, "bob"), L(10, "me"), L(12, "ann"), L(14, "cy")];

describe("repriceSellOrder", () => {
  it("ignores your own listings and says when you've been undercut", () => {
    const r = repriceSellOrder(10, market, "Me", "undercut");
    expect(r).toMatchObject({ status: "undercut", cheapest: 8, behind: 2, target: 7 });
  });
  it("match / market rules", () => {
    expect(repriceSellOrder(10, market, "me", "match").target).toBe(8);
    expect(repriceSellOrder(10, market, "me", "market").target).toBe(11); // (8+12+14)/3 = 11.3
  });
  it("is fine when you're the cheapest, and respects the floor", () => {
    expect(repriceSellOrder(5, market, "me", "undercut")).toMatchObject({ status: "cheapest", behind: 0 });
    expect(repriceSellOrder(10, market, "me", "undercut", 9).target).toBe(9);
    expect(repriceSellOrder(10, [], "me", "undercut").status).toBe("no-market");
  });
});

describe("repricedValue", () => {
  it("lowers but only raises when allowed", () => {
    const r = repriceSellOrder(5, market, "me", "undercut"); // target 7 > 5
    expect(repricedValue(5, r)).toBeNull();
    expect(repricedValue(5, r, true)).toBe(7);
    expect(repricedValue(10, repriceSellOrder(10, market, "me", "undercut"))).toBe(7);
  });
});
