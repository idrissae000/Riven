import { NextResponse } from "next/server";
import { requireUser, noStore } from "@/lib/api";
import { ReauthRequired, sessionInfo, wfmAuthedV2, wfmConfigured } from "@/lib/wfm/auth";
import { wfmRequest } from "@/lib/wfm/client";
import { itemIndex } from "@/lib/wfm/items-index";

export const maxDuration = 60;

export interface MyOrder {
  id: string; type: "sell" | "buy"; platinum: number; quantity: number; visible: boolean; rank: number; updatedAt: string | null;
  item: { id: string; slug: string; name: string; thumb: string | null; maxRank: number | null };
}
export interface MyAuction {
  id: string; name: string; weapon: string | null; price: number; startingPrice: number | null; visible: boolean; note: string; rank: number | null; rerolls: number | null; polarity: string | null;
}

interface RawOrder { id?: string; type?: string; platinum?: number; quantity?: number; visible?: boolean; rank?: number; itemId?: string; updatedAt?: string }

/** Pulls the order list out of whichever shape /v2/orders/my answers with (a plain list, or {sell, buy}). */
function ordersOf(data: unknown): RawOrder[] {
  if (Array.isArray(data)) return data as RawOrder[];
  const d = data as { orders?: RawOrder[]; sell?: RawOrder[]; buy?: RawOrder[] } | null;
  return d?.orders ?? [...(d?.sell ?? []), ...(d?.buy ?? [])];
}

/** All of the signed-in user's Warframe Market sell/buy orders and open riven auctions. */
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!wfmConfigured()) return NextResponse.json({ error: "Warframe Market sign-in isn’t configured on the server." }, { status: 503 });
  const info = await sessionInfo(auth.user.id);
  if (!info.connected) return NextResponse.json({ error: "Connect your Warframe Market account first.", reauth: true }, { status: 401, ...noStore });

  try {
    const res = await wfmAuthedV2(auth.user.id, "/v2/orders/my");
    if (!res.ok) return NextResponse.json({ error: `Warframe Market couldn’t return your orders (HTTP ${res.status}).` }, { status: 502 });
    const raw = ordersOf(((await res.json().catch(() => null)) as { data?: unknown } | null)?.data);
    const index = await itemIndex();
    const orders: MyOrder[] = raw.flatMap((o): MyOrder[] => {
      const item = o.itemId ? index.get(o.itemId) : undefined;
      if (!o.id || !item || typeof o.platinum !== "number") return [];
      return [{ id: o.id, type: o.type === "buy" ? "buy" : "sell", platinum: o.platinum, quantity: o.quantity ?? 1, visible: o.visible !== false, rank: o.rank ?? 0, updatedAt: o.updatedAt ?? null, item }];
    });

    // Riven auctions (v1 is the only place they exist). Public read by ingame name; best effort.
    let auctions: MyAuction[] = [];
    if (info.name) {
      const a = await wfmRequest(`/v1/profile/${encodeURIComponent(info.name)}/auctions`).catch(() => null);
      const json = a?.ok ? ((await a.json().catch(() => null)) as { payload?: { auctions?: Record<string, unknown>[] } } | null) : null;
      auctions = (json?.payload?.auctions ?? []).filter((x) => x.closed !== true).map((x): MyAuction => {
        const it = (x.item ?? {}) as Record<string, unknown>;
        return {
          id: String(x.id), name: String(it.name ?? "Riven"), weapon: (it.weapon_url_name as string | undefined) ?? null,
          price: Number(x.buyout_price ?? x.starting_price ?? 0), startingPrice: x.starting_price == null ? null : Number(x.starting_price),
          visible: x.visible !== false, note: String(x.note ?? ""), rank: it.mod_rank == null ? null : Number(it.mod_rank), rerolls: it.re_rolls == null ? null : Number(it.re_rolls), polarity: (it.polarity as string | undefined) ?? null,
        };
      });
    }
    return NextResponse.json({ name: info.name, orders, auctions }, noStore);
  } catch (e) {
    if (e instanceof ReauthRequired) return NextResponse.json({ error: e.message, reauth: true }, { status: 401 });
    return NextResponse.json({ error: "Could not reach Warframe Market." }, { status: 502 });
  }
}
