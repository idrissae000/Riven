import { describe, expect, it } from "vitest";
import { estimate, findComparables, similarity, type WfmAuction } from "./comparables";
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

describe("findComparables", () => {
  it("marks name matches exact (hyphen/case-insensitive) and similar-spread ones similar", () => {
    const list = findComparables(mine, [
      auction({ name: "acri-cron", attrs: [["critical_damage", 60], ["multishot", 50]] }), // exact by name
      auction({ name: "something-else" }), // similar by spread
      auction({ name: "nope", attrs: [["multishot", 90], ["recoil", -50]] }), // unrelated -> dropped
    ], unitOf);
    expect(list.map((l) => l.matchKind)).toEqual(["exact", "similar"]);
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

describe("estimate", () => {
  const mk = (prices: number[], kind: "exact" | "similar" = "exact") =>
    findComparables(mine, prices.map((p) => auction({ price: p, name: kind === "exact" ? "acricron" : "zzz" })), unitOf);

  it("never produces an estimate without enough listings backing it", () => {
    expect(estimate([])).toBeNull();
    expect(estimate(mk([100, 120]))).toBeNull();
  });

  it("uses quartiles of the cited listings", () => {
    const e = estimate(mk([100, 200, 300, 400, 500]))!;
    expect(e).toMatchObject({ low: 200, median: 300, high: 400, basis: "exact", sampleSize: 5 });
  });

  it("falls back to similar-spread listings when exact matches are too few", () => {
    const listings = [...mk([100, 120], "exact"), ...mk([150, 180, 210], "similar")];
    const e = estimate(listings)!;
    expect(e.basis).toBe("similar");
    expect(e.sampleSize).toBe(5);
  });
});
