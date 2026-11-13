import "server-only";
import { wfmAuthedV2 } from "./auth";
import { itemIndex } from "./items-index";

export interface MyOrder {
  id: string; type: "sell" | "buy"; platinum: number; quantity: number; visible: boolean; rank: number; updatedAt: string | null;
  item: { id: string; slug: string; name: string; thumb: string | null; maxRank: number | null };
}

interface RawOrder { id?: string; type?: string; platinum?: number; quantity?: number; visible?: boolean; rank?: number; itemId?: string; updatedAt?: string }

/** Pulls the order list out of whichever shape /v2/orders/my answers with (a plain list, or {sell, buy}). */
function ordersOf(data: unknown): RawOrder[] {
  if (Array.isArray(data)) return data as RawOrder[];
  const d = data as { orders?: RawOrder[]; sell?: RawOrder[]; buy?: RawOrder[] } | null;
  return d?.orders ?? [...(d?.sell ?? []), ...(d?.buy ?? [])];
}

/** The signed-in user's current Warframe Market orders. Throws ReauthRequired if the session isn't accepted; returns null if WFM answers with an error. */
export async function fetchMyOrders(userId: string): Promise<{ orders: MyOrder[] } | { status: number }> {
  const res = await wfmAuthedV2(userId, "/v2/orders/my");
  if (!res.ok) return { status: res.status };
  const raw = ordersOf(((await res.json().catch(() => null)) as { data?: unknown } | null)?.data);
  const index = await itemIndex();
  const orders = raw.flatMap((o): MyOrder[] => {
    const item = o.itemId ? index.get(o.itemId) : undefined;
    if (!o.id || !item || typeof o.platinum !== "number") return [];
    return [{ id: o.id, type: o.type === "buy" ? "buy" : "sell", platinum: o.platinum, quantity: o.quantity ?? 1, visible: o.visible !== false, rank: o.rank ?? 0, updatedAt: o.updatedAt ?? null, item }];
  });
  return { orders };
}
