import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { wfmRequest } from "@/lib/wfm/client";
import { cheapestOnline, type Listing, type RawOrder } from "@/lib/wfm/listings";

const SLUGS = new Set(primeCatalogue.parts.map((p) => p.slug));
const TTL_MS = 2 * 60_000;
const memo = new Map<string, { at: number; listings: Listing[] }>(); // only the 5 small rows are kept, never the ~200 KB order list

/** The 5 cheapest sell listings from online / in-game players for a Prime part (what someone should price their own against). */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!SLUGS.has(slug)) return NextResponse.json({ error: "Unknown item" }, { status: 404 });
  if (!rateLimit(`prime-listings:${clientIp(request.headers)}`, 200, 10 * 60_000).ok) return NextResponse.json({ error: "Too many requests — try again in a few minutes." }, { status: 429 });

  const hit = memo.get(slug);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json({ listings: hit.listings, fetchedAt: new Date(hit.at).toISOString() });
  try {
    const res = await wfmRequest(`/v2/orders/item/${encodeURIComponent(slug)}`);
    if (!res.ok) return NextResponse.json({ error: `Warframe Market answered ${res.status}.` }, { status: res.status === 429 ? 429 : 502 });
    const json = (await res.json()) as { data?: RawOrder[] };
    const listings = cheapestOnline(Array.isArray(json.data) ? json.data : [], 5, 0);
    memo.set(slug, { at: Date.now(), listings });
    if (memo.size > 800) memo.clear();
    return NextResponse.json({ listings, fetchedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "Couldn’t reach Warframe Market." }, { status: 502 });
  }
}
