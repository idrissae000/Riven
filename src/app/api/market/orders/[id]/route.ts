import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { ReauthRequired, wfmAuthedV2, wfmConfigured } from "@/lib/wfm/auth";
import { flattenErrors } from "@/lib/wfm/auth-parse";

type Ctx = { params: Promise<{ id: string }> };
const idOk = (id: string) => /^[a-f0-9]{24}$/i.test(id);
const patch = z.object({
  platinum: z.number().int().min(1).max(99_999).optional(),
  quantity: z.number().int().min(1).max(9999).optional(),
  visible: z.boolean().optional(),
}).refine((b) => Object.keys(b).length > 0, "Nothing to change");

const fail = (res: Response, codes: string[], what: string) =>
  NextResponse.json({ error: codes.length ? `Warframe Market: ${codes.slice(0, 2).join(", ")}` : `Warframe Market couldn’t ${what} (HTTP ${res.status}).` }, { status: res.status === 429 ? 429 : 422 });

/** Change an order's price / quantity / visibility. */
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!idOk(id) || !wfmConfigured()) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a whole-number price and quantity." }, { status: 400 });
  try {
    const res = await wfmAuthedV2(auth.user.id, `/v2/order/${id}`, { method: "PATCH", body: JSON.stringify(parsed.data) });
    if (!res.ok) return fail(res, flattenErrors(await res.json().catch(() => null)), "update that order");
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ReauthRequired) return NextResponse.json({ error: e.message, reauth: true }, { status: 401 });
    return NextResponse.json({ error: "Could not reach Warframe Market." }, { status: 502 });
  }
}

/** Delete an order. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!idOk(id) || !wfmConfigured()) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const res = await wfmAuthedV2(auth.user.id, `/v2/order/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) return fail(res, flattenErrors(await res.json().catch(() => null)), "remove that order");
    await auth.sb.from("order_snapshots").delete().eq("order_id", id); // removed by the user here, so not a sale
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ReauthRequired) return NextResponse.json({ error: e.message, reauth: true }, { status: 401 });
    return NextResponse.json({ error: "Could not reach Warframe Market." }, { status: 502 });
  }
}
