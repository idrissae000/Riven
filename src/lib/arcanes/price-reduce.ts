/** Reduces a WFM v2 `/orders/item/{slug}` payload (can be ~1800 orders) to a small, cacheable, cited summary. */
export interface WfmOrder {
  id: string; type: "sell" | "buy"; platinum: number; quantity: number; rank?: number; visible: boolean; updatedAt: string;
  user: { ingameName: string; slug: string; status: string; platform: string; crossplay?: boolean; reputation?: number };
}

export interface PriceListing {
  id: string; price: number; quantity: number; rank: number; seller: string; sellerUrl: string; status: string; updatedAt: string;
}

export interface RankPrice {
  rank: number;
  label: string;            // "Unranked" | "Max rank (5)" | "Rank n"
  totalListings: number;    // all visible sell orders at this rank
  onlineListings: number;   // sellers in-game or online
  low: number | null;       // cheapest listing used
  median: number | null;    // median of the cited listings
  /** The listings the figures come from (cheapest online sellers; offline only if no one is online). */
  listings: PriceListing[];
  basis: "online" | "offline";
}

export interface ArcanePriceSummary { ranks: RankPrice[]; itemUrl: string }

const isOnline = (s: string) => s === "ingame" || s === "online";

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
}

export function summarizeOrders(orders: WfmOrder[], wfmSlug: string, maxRank: number | null, cite = 5): ArcanePriceSummary {
  const sells = orders.filter((o) => o.type === "sell" && o.visible && o.quantity > 0 && (o.user.platform === "pc" || o.user.crossplay));
  const byRank = new Map<number, WfmOrder[]>();
  for (const o of sells) byRank.set(o.rank ?? 0, [...(byRank.get(o.rank ?? 0) ?? []), o]);

  const wanted = [...byRank.keys()].filter((r) => r === 0 || r === maxRank).sort((a, b) => a - b);
  const ranks: RankPrice[] = wanted.map((rank) => {
    const all = byRank.get(rank)!;
    const online = all.filter((o) => isOnline(o.user.status));
    const pool = (online.length ? online : all).sort((a, b) => a.platinum - b.platinum || +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, cite);
    return {
      rank,
      label: rank === 0 ? "Unranked" : rank === maxRank ? `Max rank (${rank})` : `Rank ${rank}`,
      totalListings: all.length,
      onlineListings: online.length,
      low: pool.length ? pool[0].platinum : null,
      median: pool.length ? median(pool.map((o) => o.platinum)) : null,
      basis: online.length ? "online" : "offline",
      listings: pool.map((o) => ({
        id: o.id, price: o.platinum, quantity: o.quantity, rank, seller: o.user.ingameName,
        sellerUrl: `https://warframe.market/profile/${o.user.slug}`, status: o.user.status, updatedAt: o.updatedAt,
      })),
    };
  });
  return { ranks, itemUrl: `https://warframe.market/items/${wfmSlug}` };
}
