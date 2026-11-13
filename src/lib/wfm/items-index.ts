import "server-only";
import { wfmRequest } from "./client";

export interface ItemInfo { id: string; slug: string; name: string; thumb: string | null; maxRank: number | null }

const DAY = 24 * 60 * 60_000;
let cache: { at: number; byId: Map<string, ItemInfo> } | null = null;
let loading: Promise<Map<string, ItemInfo>> | null = null;

/** Warframe Market's item id -> {slug, name, icon, max rank} (the orders API only gives item ids). ~1.6 MB, loaded once a day per server instance. */
export async function itemIndex(): Promise<Map<string, ItemInfo>> {
  if (cache && Date.now() - cache.at < DAY) return cache.byId;
  loading ??= (async () => {
    const res = await wfmRequest("/v2/items");
    if (!res.ok) throw new Error(`Warframe Market item list answered ${res.status}`);
    const json = (await res.json()) as { data?: { id: string; slug: string; maxRank?: number; i18n?: { en?: { name?: string; thumb?: string } } }[] };
    const byId = new Map<string, ItemInfo>();
    for (const i of json.data ?? []) byId.set(i.id, { id: i.id, slug: i.slug, name: i.i18n?.en?.name ?? i.slug, thumb: i.i18n?.en?.thumb ? `https://warframe.market/static/assets/${i.i18n.en.thumb}` : null, maxRank: i.maxRank ?? null });
    cache = { at: Date.now(), byId };
    return byId;
  })().finally(() => { loading = null; });
  return loading;
}

let names: { from: Map<string, ItemInfo>; map: Map<string, ItemInfo> } | null = null;

/**
 * Finds the Warframe Market item for a name as Baro (or the game) spells it — exact name only. (Matching "X Blueprint" to "X" was wrong:
 * the blueprint Baro sells is not the tradable item, e.g. Sands of Inaros.)
 */
export async function itemByName(name: string): Promise<ItemInfo | null> {
  const byId = await itemIndex();
  if (!names || names.from !== byId) names = { from: byId, map: new Map([...byId.values()].map((i) => [i.name.toLowerCase(), i])) };
  const n = name.trim().toLowerCase();
  return names.map.get(n) ?? null;
}
