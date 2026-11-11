import { describe, expect, it } from "vitest";
import type { WfmAuction } from "@/lib/wfm/comparables";
import { summarizeWeaponListings } from "./weapon-market";

const A = (price: number, stats: [string, boolean][] = [["critical_chance", true]], extra: Partial<WfmAuction> = {}): WfmAuction => ({
  id: `a${price}${stats.map((s) => s[0]).join("")}${Math.random()}`, buyout_price: price, starting_price: price, is_direct_sell: true, closed: false, visible: true, created: "", updated: "",
  owner: { ingame_name: "x", slug: "x", status: "ingame", reputation: 1, platform: "pc" },
  item: { type: "riven", name: "", weapon_url_name: "bo", polarity: "madurai", mastery_level: 8, mod_rank: 8, re_rolls: 1, attributes: stats.map(([url_name, positive]) => ({ url_name, value: 100, positive })) },
  ...extra,
});

describe("summarizeWeaponListings", () => {
  const rows = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((p) => A(p));
  it("median, quartile and cheapest of the usable listings", () => {
    const m = summarizeWeaponListings(rows);
    expect(m).toMatchObject({ listings: 10, low: 10, median: 55, p75: 78, saturated: false });
  });
  it("ignores auctions that aren't buy-it-now, visible and open", () => {
    const m = summarizeWeaponListings([...rows, A(1, undefined, { is_direct_sell: false }), A(2, undefined, { closed: true }), A(3, undefined, { visible: false })]);
    expect(m.listings).toBe(10);
    expect(m.low).toBe(10);
  });
  it("a full page of results means plenty of supply", () => expect(summarizeWeaponListings(Array.from({ length: 99 }, (_, i) => A(i + 1))).saturated).toBe(true));
  it("no listings → nulls", () => expect(summarizeWeaponListings([])).toEqual({ listings: 0, saturated: false, low: null, median: null, p75: null, stats: [] }));

  it("finds the stats that go with higher asks", () => {
    const cheap = Array.from({ length: 6 }, (_, i) => A(10 + i, [["zoom", true], ["recoil", true]]));
    const dear = Array.from({ length: 6 }, (_, i) => A(100 + i, [["critical_damage", true], ["zoom", true]]));
    const m = summarizeWeaponListings([...cheap, ...dear]);
    expect(m.stats[0]).toMatchObject({ stat: "critical_damage", n: 6 });
    expect(m.stats[0].withMedian).toBeGreaterThan(m.stats[0].withoutMedian * 5);
    expect(m.stats.map((s) => s.stat)).not.toContain("recoil"); // recoil goes with the cheap ones
  });
  it("won't draw conclusions from a handful of listings", () => expect(summarizeWeaponListings([A(10), A(11), A(500, [["x", true]]), A(600, [["x", true]])]).stats).toEqual([]));
  it("curses don't count as stats that sell", () => {
    const m = summarizeWeaponListings([...Array.from({ length: 6 }, (_, i) => A(10 + i, [["a", true], ["zoom", false]])), ...Array.from({ length: 6 }, (_, i) => A(200 + i, [["b", true]]))]);
    expect(m.stats.map((s) => s.stat)).not.toContain("zoom");
  });
});
