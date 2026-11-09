import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { ReauthRequired, wfmAuthed, wfmConfigured } from "@/lib/wfm/auth";
import { buildCreateAuction } from "@/lib/wfm/auction-payload";
import { flattenErrors } from "@/lib/wfm/auth-parse";
import type { Riven } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ price: z.number().int().min(1).max(99_999_999), note: z.string().max(100).optional() });

const reauth = (e: ReauthRequired) => NextResponse.json({ error: e.message, reauth: true }, { status: 401 });

/** List this riven on Warframe Market as a buy-it-now sell order. */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!wfmConfigured()) return NextResponse.json({ error: "Warframe Market sign-in isn’t configured on the server." }, { status: 503 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a whole-number price in platinum." }, { status: 400 });

  const { data } = await auth.sb.from("rivens").select("*").eq("id", id).maybeSingle(); // RLS: own rows only
  const riven = data as Riven | null;
  if (!riven) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (riven.wfm_auction_id) return NextResponse.json({ error: "This riven is already listed. Remove the listing first to re-list it." }, { status: 409 });

  const built = buildCreateAuction(riven, parsed.data);
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: 400 });

  try {
    const res = await wfmAuthed(auth.user.id, "/v1/auctions/create", { method: "POST", body: JSON.stringify(built.body) });
    const json = await res.json().catch(() => null);
    const auctionId: string | undefined = json?.payload?.auction?.id;
    if (!res.ok || !auctionId) {
      const codes = flattenErrors(json);
      return NextResponse.json({ error: `Warframe Market rejected the listing${codes.length ? `: ${codes.slice(0, 3).join(", ")}` : ` (HTTP ${res.status})`}.` }, { status: res.status === 429 ? 429 : 422 });
    }
    await auth.sb.from("rivens").update({ wfm_auction_id: auctionId, wfm_listed_at: new Date().toISOString(), wfm_price: parsed.data.price }).eq("id", id);
    return NextResponse.json({ auctionId, url: `https://warframe.market/auction/${auctionId}` }, { status: 201 });
  } catch (e) {
    if (e instanceof ReauthRequired) return reauth(e);
    return NextResponse.json({ error: "Could not reach Warframe Market." }, { status: 502 });
  }
}

/** Remove the listing from Warframe Market and unlink it here. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data } = await auth.sb.from("rivens").select("wfm_auction_id").eq("id", id).maybeSingle();
  const auctionId = (data as { wfm_auction_id: string | null } | null)?.wfm_auction_id;
  if (!auctionId) return NextResponse.json({ error: "This riven isn’t listed." }, { status: 404 });

  try {
    // WFM v1 has no DELETE on an auction (405, verified); closing is PUT .../close.
    const res = await wfmAuthed(auth.user.id, `/v1/auctions/entry/${encodeURIComponent(auctionId)}/close`, { method: "PUT", body: "{}" });
    const json = res.ok ? null : await res.json().catch(() => null);
    const alreadyGone = res.status === 404 || flattenErrors(json).includes("app.form.not_exist");
    if (!res.ok && !alreadyGone) return NextResponse.json({ error: `Warframe Market couldn’t remove the listing (HTTP ${res.status}).` }, { status: 502 });
    await auth.sb.from("rivens").update({ wfm_auction_id: null, wfm_listed_at: null, wfm_price: null }).eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ReauthRequired) return reauth(e);
    return NextResponse.json({ error: "Could not reach Warframe Market." }, { status: 502 });
  }
}
