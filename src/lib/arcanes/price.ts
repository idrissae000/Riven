import "server-only";
import { cached, type Cached } from "@/lib/wfm/cache";
import { WfmError, wfmRequest } from "@/lib/wfm/client";
import { summarizeOrders, type ArcanePriceSummary, type WfmOrder } from "./price-reduce";

/**
 * Current Warframe Market sell prices for an arcane. Same throttle + 12-min cache as rivens;
 * what's cached is the small reduced summary, not the ~1MB raw order list.
 */
export function priceArcane(wfmSlug: string, maxRank: number | null, opts: { force?: boolean } = {}): Promise<Cached<ArcanePriceSummary>> {
  return cached(
    `arcane-price:v1:${wfmSlug}`,
    async () => {
      const path = `/v2/orders/item/${encodeURIComponent(wfmSlug)}`;
      const res = await wfmRequest(path);
      if (!res.ok) throw new WfmError(`Warframe Market ${res.status} for ${path}`, res.status);
      const json = (await res.json()) as { data: WfmOrder[] };
      return summarizeOrders(json.data ?? [], wfmSlug, maxRank);
    },
    { force: opts.force, minRefreshAgeMs: 60_000 },
  );
}
