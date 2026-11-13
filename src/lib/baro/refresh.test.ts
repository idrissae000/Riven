import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshBaro } from "./refresh";

/** In-memory stand-in for the service-role client: chained selects return the table, upserts/updates are recorded. */
function fakeSb(tables: Record<string, Record<string, unknown>[]>) {
  const upserts: Record<string, Record<string, unknown>[]> = {};
  const updates: { table: string; values: Record<string, unknown> }[] = [];
  const sb = {
    from(t: string) {
      const q = {
        select: () => q, eq: () => q, gte: () => q, order: () => q, limit: () => q, not: () => q,
        upsert: async (row: Record<string, unknown> | Record<string, unknown>[]) => { (upserts[t] ??= []).push(...(Array.isArray(row) ? row : [row])); return { error: null }; },
        update: (values: Record<string, unknown>) => { const u = { eq: () => u, then: (res: (v: { error: null }) => unknown) => { updates.push({ table: t, values }); return res({ error: null }); } }; return u; },
        then: (res: (v: { data: unknown; error: null }) => unknown) => res({ data: tables[t] ?? [], error: null }),
      };
      return q;
    },
  };
  return { sb: sb as unknown as SupabaseClient, upserts, updates };
}

const NOW = Date.parse("2026-11-13T18:00:00Z");
const baro = { location: "Orcus Relay", arrives: "2026-11-13T14:00:00.000Z", leaves: "2026-11-15T14:00:00.000Z", items: [{ item: "Primed Flow", ducats: 350, credits: 110000 }, { item: "Ki'teer Earpiece", ducats: 500, credits: 400000 }] };
const resolve = async (name: string) => (name === "Primed Flow" ? "primed_flow" : null);
const order = (platinum: number) => ({ type: "sell", platinum, quantity: 1, rank: 0, visible: true, user: { status: "ingame", platform: "pc" } });
const get = async (path: string) => new Response(JSON.stringify(path.startsWith("/v2/orders") ? { data: [order(30), order(34), order(90)] } : { payload: { statistics_closed: { "90days": [] } } }));

describe("refreshBaro", () => {
  it("does nothing when Baro isn't here", async () => {
    const { sb } = fakeSb({});
    expect(await refreshBaro(sb, get, null, resolve, { now: NOW })).toMatchObject({ active: false });
    expect(await refreshBaro(sb, get, { ...baro, arrives: "2026-11-27T14:00:00.000Z" }, resolve, { now: NOW })).toMatchObject({ active: false });
  });
  it("records his stock, marks untradable items done, and prices the tradable ones", async () => {
    const { sb, upserts, updates } = fakeSb({});
    const r = await refreshBaro(sb, get, baro, resolve, { now: NOW });
    expect(r).toMatchObject({ active: true, refreshed: 1, rateLimited: false });
    const rows = upserts.baro_items;
    expect(rows.find((x) => x.name === "Primed Flow")).toMatchObject({ wfm_slug: "primed_flow", ducats: 350, credits: 110000, computed_at: null });
    expect(rows.find((x) => x.name === "Ki'teer Earpiece")).toMatchObject({ wfm_slug: null }); // untradable: no analysis needed
    expect(updates.find((u) => u.table === "baro_items")?.values).toMatchObject({ price_now: 51.3, listings: 3, cycles: 0, confidence: "none", pre_price: null });
  });
});
