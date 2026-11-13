import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchTop, WfmFetchError, type WfmGet } from "@/lib/arcanes/refresh";
import { pickStale } from "@/lib/arcanes/top-price";

export const ITEM_PRICE_TTL_MS = 90 * 60_000; // the long tail of cheap parts
export const HOT_ITEM_TTL_MS = 15 * 60_000; // parts worth 15p+ are where a stale price costs platinum, so they are checked every 15 minutes

export interface ItemBatchResult {
  refreshed: number;
  /** Items still due a refresh after this batch. */
  remaining: number;
  /** Warframe Market rate-limited us (the batch stopped early; what was fetched is saved). */
  rateLimited: boolean;
}

/** Refresh the stalest item prices from `universe` (never-fetched first), a few per call, and save them. `sb` must be a service-role client. */
export async function refreshItemBatch(
  sb: SupabaseClient,
  get: WfmGet,
  universe: string[],
  opts: { limit?: number; now?: number } = {},
): Promise<ItemBatchResult> {
  const { limit = 20, now = Date.now() } = opts;
  const { data, error } = await sb.from("item_prices").select("slug,fetched_at,avg5");
  if (error) throw new Error(error.message);
  const have = new Map((data ?? []).map((r) => [r.slug as string, { at: r.fetched_at as string | null, avg5: r.avg5 == null ? null : Number(r.avg5) }]));
  const due = pickStale(universe.map((slug) => ({ slug })), (r) => have.get(r.slug)?.at, now, (r) => ((have.get(r.slug)?.avg5 ?? 0) >= 15 ? HOT_ITEM_TTL_MS : ITEM_PRICE_TTL_MS), Infinity);
  const out: ItemBatchResult = { refreshed: 0, remaining: due.length, rateLimited: false };
  const nowIso = new Date(now).toISOString();
  try {
    for (const it of due.slice(0, limit)) {
      const top = await fetchTop(get, it.slug, 0);
      const { error: e } = await sb.from("item_prices").upsert({ slug: it.slug, low: top.low, avg5: top.avg5, listings: top.listings, fetched_at: nowIso }, { onConflict: "slug" });
      if (e) throw new Error(e.message);
      if (top.avg5 != null) await sb.from("price_history").upsert({ slug: it.slug, day: nowIso.slice(0, 10), price: top.avg5, listings: top.listings }, { onConflict: "slug,day" });
      out.refreshed++; out.remaining--;
    }
  } catch (e) {
    if (e instanceof WfmFetchError && e.status === 429) out.rateLimited = true;
    else throw e;
  }
  return out;
}
