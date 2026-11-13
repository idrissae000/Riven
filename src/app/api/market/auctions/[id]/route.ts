import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { ReauthRequired, wfmAuthed, wfmConfigured } from "@/lib/wfm/auth";
import { flattenErrors } from "@/lib/wfm/auth-parse";

type Ctx = { params: Promise<{ id: string }> };
const idOk = (id: string) => /^[a-zA-Z0-9]{10,40}$/.test(id);
const body = z.object({ price: z.number().int().min(1).max(99_999_999), note: z.string().max(100).optional(), visible: z.boolean().optional() });

/** Re-price a riven auction (buy-it-now, with the same starting price). v1 is the only API that has riven auctions. */
export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!idOk(id) || !wfmConfigured()) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a whole-number price." }, { status: 400 });
  try {
    const res = await wfmAuthed(auth.user.id, `/v1/auctions/entry/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ starting_price: parsed.data.price, buyout_price: parsed.data.price, minimal_reputation: 0, note: parsed.data.note ?? "", private: false, visible: parsed.data.visible ?? true }),
    });
    if (!res.ok) { const codes = flattenErrors(await res.json().catch(() => null)); return NextResponse.json({ error: codes.length ? `Warframe Market: ${codes.slice(0, 2).join(", ")}` : `Warframe Market couldn’t update the auction (HTTP ${res.status}).` }, { status: 422 }); }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ReauthRequired) return NextResponse.json({ error: e.message, reauth: true }, { status: 401 });
    return NextResponse.json({ error: "Could not reach Warframe Market." }, { status: 502 });
  }
}

/** Close (remove) a riven auction. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!idOk(id) || !wfmConfigured()) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const res = await wfmAuthed(auth.user.id, `/v1/auctions/entry/${encodeURIComponent(id)}/close`, { method: "PUT", body: "{}" });
    if (!res.ok && res.status !== 404) return NextResponse.json({ error: `Warframe Market couldn’t close the auction (HTTP ${res.status}).` }, { status: 502 });
    // keep our own riven record in step if this auction was listed from here (RLS: own rows only)
    await auth.sb.from("rivens").update({ wfm_auction_id: null, wfm_listed_at: null, wfm_price: null }).eq("wfm_auction_id", id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ReauthRequired) return NextResponse.json({ error: e.message, reauth: true }, { status: 401 });
    return NextResponse.json({ error: "Could not reach Warframe Market." }, { status: 502 });
  }
}
