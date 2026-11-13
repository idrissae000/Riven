import type { SupabaseClient } from "@supabase/supabase-js";
import { WfmFetchError, fetchOrders, type WfmGet } from "@/lib/arcanes/refresh";
import { reduceTopOrders } from "@/lib/arcanes/top-price";
import { refreshSalesBatch } from "@/lib/history-sales";
import type { Baro } from "@/lib/worldstate";
import { analyseBaro, type DayPrice } from "./analysis";

export const BARO_TTL_MS = 15 * 60_000; // a tradable item's live price + analysis is re-checked every 15 minutes while Baro is here

export interface BaroRefreshResult { active: boolean; refreshed: number; remaining: number; rateLimited: boolean }

/**
 * While Baro is here: records his stock for this visit, and (a few per call) works out each tradable item's live price and what
 * his past visits did to its price. `resolve` maps his item name to a Warframe Market slug (null = not tradable). `sb` must be a service-role client.
 */
export async function refreshBaro(
  sb: SupabaseClient, get: WfmGet, baro: Baro | null, resolve: (name: string) => Promise<string | null>,
  opts: { limit?: number; now?: number } = {},
): Promise<BaroRefreshResult> {
  const { limit = 3, now = Date.now() } = opts;
  const out: BaroRefreshResult = { active: false, refreshed: 0, remaining: 0, rateLimited: false };
  if (!baro || baro.items.length === 0 || Date.parse(baro.arrives) > now) return out; // not here (yet): nothing to do
  out.active = true;
  const visit = new Date(baro.arrives).toISOString();
  const nowIso = new Date(now).toISOString();

  const { data: have, error } = await sb.from("baro_items").select("name,wfm_slug,computed_at").eq("visit", visit);
  if (error) throw new Error(error.message);
  const known = new Map((have ?? []).map((r) => [r.name as string, r as { name: string; wfm_slug: string | null; computed_at: string | null }]));

  // new stock for this visit
  const fresh = baro.items.filter((i) => !known.has(i.item));
  if (fresh.length) {
    const rows = await Promise.all(fresh.map(async (i) => {
      const slug = await resolve(i.item);
      return { visit, name: i.item, ducats: i.ducats, credits: i.credits, wfm_slug: slug, computed_at: slug ? null : nowIso }; // untradable items need no analysis
    }));
    const { error: e } = await sb.from("baro_items").upsert(rows, { onConflict: "visit,name" });
    if (e) throw new Error(e.message);
    for (const r of rows) known.set(r.name, { name: r.name, wfm_slug: r.wfm_slug, computed_at: r.computed_at });
  }

  const due = [...known.values()].filter((r) => r.wfm_slug && !(r.computed_at && now - Date.parse(r.computed_at) < BARO_TTL_MS))
    .sort((a, b) => (a.computed_at ? Date.parse(a.computed_at) : -Infinity) - (b.computed_at ? Date.parse(b.computed_at) : -Infinity));
  out.remaining = due.length;

  try {
    for (const r of due.slice(0, limit)) {
      const slug = r.wfm_slug as string;
      await refreshSalesBatch(sb, get, [{ slug, wfm_slug: slug }], { limit: 1, now }); // copies the 90-day sales history if it's missing or a day old
      const since = new Date(now - 100 * 86_400_000).toISOString().slice(0, 10);
      const { data: hist } = await sb.from("sales_history").select("day,avg_price").eq("slug", slug).gte("day", since).order("day").limit(200);
      const history: DayPrice[] = ((hist ?? []) as { day: string; avg_price: number | string }[]).map((h) => ({ day: h.day, price: Number(h.avg_price) }));
      const top = reduceTopOrders(await fetchOrders(get, slug), 5, 0);
      const a = analyseBaro(history, visit);
      const { error: e } = await sb.from("baro_items").update({
        price_now: top.avg5, listings: top.listings, pre_price: a.pre, ratio_short: a.ratioShort, ratio_long: a.ratioLong, dip_share: a.dipShare, cycles: a.cycles, confidence: a.confidence, computed_at: nowIso,
      }).eq("visit", visit).eq("name", r.name);
      if (e) throw new Error(e.message);
      out.refreshed++; out.remaining--;
    }
  } catch (e) {
    if (e instanceof WfmFetchError && e.status === 429) out.rateLimited = true;
    else throw e;
  }
  return out;
}
