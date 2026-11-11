import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshArcaneBatch } from "@/lib/arcanes/refresh";
import { refreshItemBatch } from "@/lib/primes/refresh";
import { refreshWeaponBatch } from "@/lib/rivens/refresh";

/** A minimal in-memory stand-in for the service-role Supabase client: selects return the table, upserts are recorded. */
function fakeSb(tables: Record<string, Record<string, unknown>[]>) {
  const upserts: Record<string, Record<string, unknown>[]> = {};
  const sb = {
    from(t: string) {
      const q = {
        select: () => q, not: () => q, limit: () => q,
        upsert: async (row: Record<string, unknown> | Record<string, unknown>[]) => { (upserts[t] ??= []).push(...(Array.isArray(row) ? row : [row])); return { error: null }; },
        then: (res: (v: { data: unknown; error: null }) => unknown) => res({ data: tables[t] ?? [], error: null }),
      };
      return q;
    },
  };
  return { sb: sb as unknown as SupabaseClient, upserts };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const sell = (...p: number[]) => ({ data: { sell: p.map((platinum) => ({ type: "sell", platinum, quantity: 1, rank: 0, visible: true, user: { status: "ingame", platform: "pc" } })) } });
const NOW = Date.parse("2026-11-11T12:00:00Z");

describe("refreshItemBatch (Prime parts)", () => {
  it("fetches the stalest first, saves their prices, and reports what's left", async () => {
    const { sb, upserts } = fakeSb({ item_prices: [{ slug: "a", fetched_at: "2026-11-11T11:50:00Z" }] }); // a is fresh
    const asked: string[] = [];
    const r = await refreshItemBatch(sb, async (path) => { asked.push(path); return json(sell(10, 20)); }, ["a", "b", "c"], { limit: 1, now: NOW });
    expect(r).toEqual({ refreshed: 1, remaining: 1, rateLimited: false });
    expect(asked).toEqual(["/v2/orders/item/b/top?rank=0"]);
    expect(upserts.item_prices[0]).toMatchObject({ slug: "b", low: 10, avg5: 15, listings: 2 });
  });
  it("stops cleanly when Warframe Market rate-limits", async () => {
    const { sb, upserts } = fakeSb({});
    const r = await refreshItemBatch(sb, async () => json({}, 429), ["a", "b"], { now: NOW });
    expect(r).toEqual({ refreshed: 0, remaining: 2, rateLimited: true });
    expect(upserts.item_prices).toBeUndefined();
  });
  it("does nothing when everything is fresh", async () => {
    const { sb } = fakeSb({ item_prices: [{ slug: "a", fetched_at: "2026-11-11T11:59:00Z" }] });
    expect(await refreshItemBatch(sb, async () => { throw new Error("should not fetch"); }, ["a"], { now: NOW })).toEqual({ refreshed: 0, remaining: 0, rateLimited: false });
  });
});

describe("refreshWeaponBatch (riven market per weapon)", () => {
  it("summarises a weapon's listings and saves them", async () => {
    const auction = (price: number) => ({ id: `x${price}`, buyout_price: price, starting_price: price, is_direct_sell: true, closed: false, visible: true, created: "", updated: "", owner: { ingame_name: "s", slug: "s", status: "ingame", reputation: 1, platform: "pc" }, item: { type: "riven", name: "", weapon_url_name: "bo", polarity: "madurai", mastery_level: 8, mod_rank: 8, re_rolls: 1, attributes: [{ url_name: "critical_chance", value: 100, positive: true }] } });
    const { sb, upserts } = fakeSb({ weapons: [{ slug: "bo" }, { slug: "soma" }], weapon_riven_prices: [{ slug: "soma", fetched_at: "2026-11-11T11:00:00Z" }] });
    const r = await refreshWeaponBatch(sb, async (path) => { expect(path).toContain("weapon_url_name=bo"); return json({ payload: { auctions: [10, 20, 30].map(auction) } }); }, { now: NOW });
    expect(r).toEqual({ refreshed: 1, remaining: 0, rateLimited: false });
    expect(upserts.weapon_riven_prices[0]).toMatchObject({ slug: "bo", listings: 3, low: 10, median: 20, saturated: false });
  });
});

describe("refreshArcaneBatch (rank 0 + max rank + sales)", () => {
  it("fetches both ranks for each stale arcane and saves them together", async () => {
    const { sb, upserts } = fakeSb({ arcanes: [{ slug: "arcane_x", wfm_slug: "arcane_x", max_rank: 5 }], arcane_prices: [] });
    const asked: string[] = [];
    const get = async (path: string) => {
      asked.push(path);
      if (path.endsWith("rank=0")) return json({ data: { sell: [{ type: "sell", platinum: 4, quantity: 1, rank: 0, visible: true, user: { status: "ingame", platform: "pc" } }] } });
      if (path.endsWith("rank=5")) return json({ data: { sell: [{ type: "sell", platinum: 84, quantity: 1, rank: 5, visible: true, user: { status: "ingame", platform: "pc" } }] } });
      return json({ payload: { statistics_closed: { "48hours": [{ mod_rank: 0, volume: 10, avg_price: 4 }] } } });
    };
    const r = await refreshArcaneBatch(sb, get, { now: NOW });
    expect(asked.slice(0, 2)).toEqual(["/v2/orders/item/arcane_x/top?rank=0", "/v2/orders/item/arcane_x/top?rank=5"]);
    expect(upserts.arcane_prices[0]).toMatchObject({ slug: "arcane_x", avg5: 4, listings: 1, max_avg5: 84, max_listings: 1 });
    expect(upserts.arcane_prices[1]).toMatchObject({ slug: "arcane_x", volume_48h: 10, sold_avg_48h: 4 }); // sales come once prices are current
    expect(r).toMatchObject({ prices: 1, stats: 1, rateLimited: false });
  });
});
