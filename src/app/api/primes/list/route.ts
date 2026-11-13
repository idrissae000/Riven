import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { ReauthRequired, wfmAuthed, wfmConfigured } from "@/lib/wfm/auth";
import { flattenErrors } from "@/lib/wfm/auth-parse";
import { wfmRequest } from "@/lib/wfm/client";

export const maxDuration = 60;

const SLUGS = new Set(primeCatalogue.parts.map((p) => p.slug));
const body = z.object({
  items: z.array(z.object({
    slug: z.string().min(1).max(120),
    platinum: z.number().int().min(1).max(99_999),
    quantity: z.number().int().min(1).max(9999),
  })).min(1).max(10),
});

const ids = new Map<string, string>(); // slug -> Warframe Market item id (never changes)
async function itemId(slug: string): Promise<string | null> {
  const known = ids.get(slug);
  if (known) return known;
  const res = await wfmRequest(`/v2/item/${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  const id = ((await res.json().catch(() => null)) as { data?: { id?: string } } | null)?.data?.id;
  if (id) ids.set(slug, id);
  return id ?? null;
}

interface Result { slug: string; ok: boolean; error?: string }

/**
 * Posts sell orders (visible, buy-it-now) for the signed-in user's connected Warframe Market account — up to 10 per call;
 * the page sends bigger lists in chunks. Each item succeeds or fails on its own.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!wfmConfigured()) return NextResponse.json({ error: "Warframe Market sign-in isn’t configured on the server." }, { status: 503 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send 1–10 items, each with a whole-number price and quantity." }, { status: 400 });

  const results: Result[] = [];
  try {
    for (const it of parsed.data.items) {
      if (!SLUGS.has(it.slug)) { results.push({ slug: it.slug, ok: false, error: "Unknown item" }); continue; }
      const id = await itemId(it.slug);
      if (!id) { results.push({ slug: it.slug, ok: false, error: "Couldn’t look the item up on Warframe Market" }); continue; }

      // v1 first (same session style the riven listing uses); fall back to v2 if v1 has been retired.
      let res = await wfmAuthed(auth.user.id, "/v1/profile/orders", { method: "POST", body: JSON.stringify({ item: id, order_type: "sell", platinum: it.platinum, quantity: it.quantity, visible: true }) });
      if ([404, 405, 410].includes(res.status)) res = await wfmAuthed(auth.user.id, "/v2/order", { method: "POST", body: JSON.stringify({ itemId: id, type: "sell", platinum: it.platinum, quantity: it.quantity, visible: true }) });
      if (res.ok) { results.push({ slug: it.slug, ok: true }); continue; }
      const codes = flattenErrors(await res.json().catch(() => null));
      if (res.status === 429) { results.push({ slug: it.slug, ok: false, error: "Warframe Market is rate-limiting us — try again in a moment" }); break; }
      results.push({ slug: it.slug, ok: false, error: codes.length ? friendly(codes) : `Rejected (HTTP ${res.status})` });
    }
  } catch (e) {
    if (e instanceof ReauthRequired) return NextResponse.json({ error: e.message, reauth: true, results }, { status: 401 });
    return NextResponse.json({ error: "Could not reach Warframe Market.", results }, { status: 502 });
  }
  return NextResponse.json({ results });
}

/** WFM's error codes are dotted keys like "app.post_order.already_exists". */
function friendly(codes: string[]): string {
  const c = codes.join(" ");
  if (/already_exist/.test(c)) return "You already have a sell order for this item — remove it on warframe.market first";
  if (/limit|too_many|max/.test(c)) return "Order limit reached on your Warframe Market account";
  return codes.slice(0, 2).join(", ");
}
