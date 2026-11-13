import { describe, expect, it } from "vitest";
import { autoPrice, cheapestOnline, type RawOrder } from "./listings";

const o = (platinum: number, status: string, extra: Partial<RawOrder> = {}): RawOrder => ({ type: "sell", platinum, quantity: 1, rank: 0, visible: true, user: { ingameName: `p${platinum}`, status, platform: "pc" }, ...extra });

describe("cheapestOnline", () => {
  it("keeps the 5 cheapest sell listings from online / in-game players only", () => {
    const r = cheapestOnline([o(1, "offline"), o(30, "ingame"), o(9, "online"), o(2, "invisible"), o(12, "ingame"), o(15, "ingame", { visible: false }), o(20, "ingame", { type: "buy" }), o(11, "ingame"), o(13, "online"), o(14, "ingame"), o(99, "ingame")]);
    expect(r.map((l) => l.platinum)).toEqual([9, 11, 12, 13, 14]);
    expect(r[0]).toMatchObject({ seller: "p9", status: "online", quantity: 1 });
  });
  it("is empty when nobody is online", () => expect(cheapestOnline([o(5, "offline")])).toEqual([]));
});

describe("autoPrice", () => {
  const l = cheapestOnline([o(10, "ingame"), o(12, "ingame"), o(14, "online")]);
  it("market = average, undercut = cheapest − 1, match = cheapest", () => {
    expect(autoPrice(l, "market")).toBe(12);
    expect(autoPrice(l, "undercut")).toBe(9);
    expect(autoPrice(l, "match")).toBe(10);
  });
  it("never goes below 1 and gives nothing without listings", () => {
    expect(autoPrice(cheapestOnline([o(1, "ingame")]), "undercut")).toBe(1);
    expect(autoPrice([], "market")).toBeNull();
  });
});
