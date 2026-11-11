import { describe, expect, it } from "vitest";
import { findComparables, sharedStats, similarity, type WfmAuction } from "./comparables";
import { auctionQueries } from "./pricing";
import { toMaxRank } from "@/lib/rank";
import type { RivenStat } from "@/lib/types";

const unitOf = (s: string) => (s === "damage_vs_infested" ? "multiply" : "percent");

const mine = {
  weapon_slug: "soma", riven_name: "Acri-cron", rank: 8,
  stats: [
    { stat: "critical_damage", value: 120, is_negative: false },
    { stat: "critical_chance", value: 150, is_negative: false },
    { stat: "zoom", value: -40, is_negative: true },
  ] as RivenStat[],
};

let n = 0;
function auction(over: Partial<WfmAuction> & { name?: string; rank?: number; attrs?: [string, number][]; price?: number }): WfmAuction {
  const attrs = over.attrs ?? [["critical_damage", 120], ["critical_chance", 150], ["zoom", -40]];
  return {
    id: `a${++n}`, buyout_price: over.price ?? 100, starting_price: 1, is_direct_sell: true, closed: false, visible: true,
    created: "2026-11-01T00:00:00Z", updated: "2026-11-02T00:00:00Z",
    owner: { ingame_name: "Seller" + n, slug: "seller" + n, status: "ingame", reputation: 1, platform: "pc" },
    item: {
      type: "riven", name: over.name ?? "acricron", weapon_url_name: "soma", polarity: "madurai", mastery_level: 10,
      mod_rank: over.rank ?? 8, re_rolls: 3, attributes: attrs.map(([url_name, value]) => ({ url_name, value, positive: value >= 0 && url_name !== "zoom" })),
    },
    ...over,
  } as WfmAuction;
}

describe("toMaxRank", () => {
  it("scales by (8+1)/(rank+1)", () => {
    expect(toMaxRank(16.4, 0, "percent")).toBeCloseTo(147.6);
    expect(toMaxRank(50, 8, "percent")).toBe(50);
  });
  it("scales only the part above x1 for multiplier stats", () => {
    expect(toMaxRank(1.06, 0, "multiply")).toBeCloseTo(1.54);
  });
});

describe("similarity", () => {
  it("normalises rank before comparing: unranked listing equals our max-rank riven", () => {
    const unranked = auction({ rank: 0, attrs: [["critical_damage", 120 / 9], ["critical_chance", 150 / 9], ["zoom", -40 / 9]] });
    expect(similarity(mine, unranked.item, unitOf).score).toBeGreaterThan(0.95);
  });
  it("scores unrelated stats near zero", () => {
    const other = auction({ attrs: [["multishot", 90], ["recoil", -50]] });
    expect(similarity(mine, other.item, unitOf).matched).toBe(0);
  });
});

const stat = (name: string, neg = false): RivenStat => ({ stat: name, value: neg ? -40 : 100, is_negative: neg });
// In the fixture the sign decides `positive`, except zoom which is always a curse; build explicit listings instead:
const withAttrs = (attrs: { url_name: string; positive: boolean }[]) => ({ ...auction({}).item, attributes: attrs.map((a) => ({ ...a, value: a.positive ? 100 : -40 })) });

describe("sharedStats (the matching rule; the riven NAME is ignored)", () => {
  const L = (pos: string[], neg: string[] = []) => withAttrs([...pos.map((u) => ({ url_name: u, positive: true })), ...neg.map((u) => ({ url_name: u, positive: false }))]);

  it("2 stats: both must match", () => {
    const mine = [stat("a"), stat("b")];
    expect(sharedStats(mine, L(["a", "b"])).qualifies).toBe(true);
    expect(sharedStats(mine, L(["a", "b", "c"])).qualifies).toBe(true); // extra stats on the listing are fine
    expect(sharedStats(mine, L(["a", "c"])).qualifies).toBe(false);
  });
  it("3 stats: any 2 must match (curse counts)", () => {
    const mine = [stat("a"), stat("b"), stat("z", true)];
    expect(sharedStats(mine, L(["a", "b"])).qualifies).toBe(true);
    expect(sharedStats(mine, L(["a"], ["z"])).qualifies).toBe(true);
    expect(sharedStats(mine, L(["a"])).qualifies).toBe(false);
    const threePos = [stat("a"), stat("b"), stat("c")];
    expect(sharedStats(threePos, L(["b", "c", "x"])).qualifies).toBe(true);
    expect(sharedStats(threePos, L(["c", "x", "y"])).qualifies).toBe(false);
  });
  it("4 stats: at least 2 POSITIVE stats must match (the curse alone doesn't count)", () => {
    const mine = [stat("a"), stat("b"), stat("c"), stat("z", true)];
    expect(sharedStats(mine, L(["a", "c"])).qualifies).toBe(true);
    expect(sharedStats(mine, L(["a"], ["z"])).qualifies).toBe(false);
    expect(sharedStats(mine, L([], ["z"])).qualifies).toBe(false);
  });
  it("a stat only matches in the same role (bonus vs curse)", () => {
    const mine = [stat("a"), stat("b")];
    expect(sharedStats(mine, L(["a"], ["b"])).qualifies).toBe(false);
  });
});

describe("findComparables", () => {
  it("ignores the riven name entirely", () => {
    const list = findComparables(mine, [auction({ name: "totally-different-name" }), auction({ name: "acri-cron" })], unitOf);
    expect(list).toHaveLength(2);
  });

  it("marks listings with ALL our stats exact, and ones that merely share enough similar", () => {
    const two = { ...mine, stats: mine.stats.slice(0, 2) }; // 2 stats: crit damage + crit chance, both required
    const list = findComparables(two, [
      auction({ attrs: [["critical_damage", 120], ["critical_chance", 150], ["multishot", 90]] }),
      auction({ attrs: [["critical_damage", 120], ["multishot", 90]] }), // only 1 of 2 -> excluded for a 2-stat riven
    ], unitOf);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ matchKind: "exact", matched: 2, total: 2 });
  });

  it("3-stat riven also accepts listings sharing just 2 stats, ranked after full matches", () => {
    const list = findComparables(mine, [
      auction({ price: 50, attrs: [["critical_damage", 120], ["critical_chance", 150]] }), // 2 of 3 -> similar
      auction({ price: 90, attrs: [["critical_damage", 120], ["critical_chance", 150], ["zoom", -40]] }), // all 3 -> exact
      auction({ price: 10, attrs: [["critical_damage", 120]] }), // 1 of 3 -> excluded
    ], unitOf);
    expect(list.map((l) => [l.matchKind, l.matched])).toEqual([["exact", 3], ["similar", 2]]);
  });

  it("drops closed, hidden, non-direct, wrong-weapon and duplicate auctions", () => {
    const ok = auction({});
    const list = findComparables(mine, [
      ok, ok,
      { ...auction({}), closed: true }, { ...auction({}), visible: false }, { ...auction({}), is_direct_sell: false },
      { ...auction({}), buyout_price: null },
      { ...auction({}), item: { ...auction({}).item, weapon_url_name: "boltor" } },
    ] as WfmAuction[], unitOf);
    expect(list).toHaveLength(1);
  });

  it("cites seller, price, time and stats for every listing", () => {
    const [l] = findComparables(mine, [auction({ price: 77 })], unitOf);
    expect(l).toMatchObject({ price: 77, postedAt: "2026-11-02T00:00:00Z" });
    expect(l.seller).toMatch(/^Seller/);
    expect(l.url).toContain("warframe.market/auction/");
    expect(l.stats.length).toBe(3);
  });
});

describe("auctionQueries (finds listings that share only some stats)", () => {
  const q = (stats: RivenStat[]) => auctionQueries({ weapon_slug: "soma", stats });
  it("2 stats: one query requiring both", () => {
    const r = q([stat("a"), stat("b")]);
    expect(r).toHaveLength(2); // weapon-wide + the pair
    expect(r[1]).toContain("positive_stats=a,b");
  });
  it("3 stats (2 bonus + curse): the three ways to pick 2", () => {
    const r = q([stat("a"), stat("b"), stat("z", true)]);
    expect(r.slice(1)).toEqual(expect.arrayContaining([
      expect.stringContaining("positive_stats=a,b"),
      expect.stringMatching(/positive_stats=a&negative_stats=z$/),
      expect.stringMatching(/positive_stats=b&negative_stats=z$/),
    ]));
    expect(r).toHaveLength(4);
  });
  it("4 stats: every pair of positives (the curse is not required)", () => {
    const r = q([stat("a"), stat("b"), stat("c"), stat("z", true)]);
    expect(r).toHaveLength(4);
    expect(r.every((u) => !u.includes("negative_stats"))).toBe(true);
  });
});
