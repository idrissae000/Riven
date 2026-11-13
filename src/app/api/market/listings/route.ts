import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { resolveItem } from "@/lib/wfm/resolve-item";
import { wfmRequest } from "@/lib/wfm/client";
import { cheapestOnline, type Listing, type RawOrder } from "@/lib/wfm/listings";

const TTL_MS = 2 * 60_000;
const memo = new Map<string, { at: number; listings: Listing[] }>(); // only the 5 small rows are kept, never the ~200 KB order list

/** The 5 cheapest sell listings from online / in-game players for a Prime part or arcane (at the rank asked), i.e. what to price against. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const item = await resolveItem(q.get("kind") ?? "prime", q.get("slug") ?? "", Number(q.get("rank") ?? 0) || 0);
  if (!item) return NextResponse.json({ error: "Unknown item" }, { status: 404 });
  if (!rateLimit(`market-listings:${clientIp(request.headers)}`, 300, 10 * 60_000).ok) return NextResponse.json({ error: "Too many requests — try again in a few minutes." }, { status: 429 });

  const key = `${item.wfm}:${item.rank}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json({ listings: hit.listings, fetchedAt: new Date(hit.at).toISOString() });
  try {
    const res = await wfmRequest(`/v2/orders/item/${encodeURIComponent(item.wfm)}`);
    if (!res.ok) return NextResponse.json({ error: `Warframe Market answered ${res.status}.` }, { status: res.status === 429 ? 429 : 502 });
    const json = (await res.json()) as { data?: RawOrder[] };
    const listings = cheapestOnline(Array.isArray(json.data) ? json.data : [], 5, item.rank);
    memo.set(key, { at: Date.now(), listings });
    if (memo.size > 800) memo.clear();
    return NextResponse.json({ listings, fetchedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "Couldn’t reach Warframe Market." }, { status: 502 });
  }
}
