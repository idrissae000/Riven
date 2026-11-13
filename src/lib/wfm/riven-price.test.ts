import { describe, expect, it } from "vitest";
import { cheapestOnlineRivens, rivenAutoPrice, type MarketListing } from "./riven-price";

const l = (price: number, sellerStatus: string): MarketListing => ({ id: String(price) + sellerStatus, seller: "s" + price, sellerStatus, price, matchKind: "exact" });
describe("riven pricing", () => {
  const online = cheapestOnlineRivens([l(300, "ingame"), l(100, "offline"), l(250, "online"), l(400, "ingame"), l(500, "online"), l(600, "ingame"), l(700, "ingame"), l(50, "invisible")]);
  it("keeps the 5 cheapest online / in-game comparables", () => expect(online.map((x) => x.price)).toEqual([250, 300, 400, 500, 600]));
  it("prices by strategy", () => {
    const est = { low: 180, median: 260.4, high: 400 };
    expect(rivenAutoPrice(est, online, "median")).toBe(260);
    expect(rivenAutoPrice(est, online, "low")).toBe(180);
    expect(rivenAutoPrice(est, online, "undercut")).toBe(249);
    expect(rivenAutoPrice(est, online, "match")).toBe(250);
  });
  it("gives nothing without data", () => { expect(rivenAutoPrice(null, [], "median")).toBeNull(); expect(rivenAutoPrice(null, [], "undercut")).toBeNull(); });
});
