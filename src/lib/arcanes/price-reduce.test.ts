import { describe, expect, it } from "vitest";
import { summarizeOrders, type WfmOrder } from "./price-reduce";

let n = 0;
const o = (over: Partial<WfmOrder> & { status?: string; name?: string }): WfmOrder => ({
  id: `o${++n}`, type: "sell", platinum: 100, quantity: 1, rank: 0, visible: true, updatedAt: "2026-11-01T00:00:00Z",
  user: { ingameName: over.name ?? `U${n}`, slug: `u${n}`, status: over.status ?? "ingame", platform: "pc", crossplay: true },
  ...over,
});

describe("summarizeOrders", () => {
  it("groups by rank (unranked + max), prices from the cheapest ONLINE sellers, and cites them", () => {
    const s = summarizeOrders([
      o({ platinum: 50, status: "offline", rank: 0 }), // cheaper but offline: ignored while online sellers exist
      o({ platinum: 120, rank: 0 }), o({ platinum: 100, rank: 0 }), o({ platinum: 140, rank: 0 }),
      o({ platinum: 900, rank: 5 }), o({ platinum: 800, rank: 5 }),
      o({ platinum: 10, rank: 3 }), // not a displayed rank
    ], "arcane_x", 5);
    expect(s.ranks.map((r) => r.label)).toEqual(["Unranked", "Max rank (5)"]);
    const r0 = s.ranks[0];
    expect(r0).toMatchObject({ low: 100, median: 120, basis: "online", onlineListings: 3, totalListings: 4 });
    expect(r0.listings.map((l) => l.price)).toEqual([100, 120, 140]);
    expect(r0.listings[0].sellerUrl).toContain("warframe.market/profile/");
    expect(s.ranks[1]).toMatchObject({ low: 800, median: 850 });
    expect(s.itemUrl).toBe("https://warframe.market/items/arcane_x");
  });

  it("falls back to offline sellers (flagged) when nobody is online", () => {
    const s = summarizeOrders([o({ platinum: 70, status: "offline" })], "x", 5);
    expect(s.ranks[0]).toMatchObject({ basis: "offline", low: 70, onlineListings: 0 });
  });

  it("ignores buy orders, hidden orders, empty stock and console-only sellers", () => {
    const s = summarizeOrders([
      o({ type: "buy" }), o({ visible: false }), o({ quantity: 0 }),
      { ...o({}), user: { ingameName: "ps", slug: "ps", status: "ingame", platform: "ps4", crossplay: false } },
    ], "x", 5);
    expect(s.ranks).toEqual([]);
  });
});
