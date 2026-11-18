import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { ReauthRequired, wfmAuthedV2, wfmConfigured } from "@/lib/wfm/auth";
import { flattenErrors } from "@/lib/wfm/auth-parse";
import { primeCatalogue } from "@/lib/primes/catalogue";

const idOk = (id: string) => /^[a-f0-9]{24}$/i.test(id);
const BY_NAME = new Map(primeCatalogue.parts.map((p) => [p.name.toLowerCase(), p.slug]));
const body = z.object({
  /** how many you had listed, and how many of them sold */
  from: z.number().int().min(1).max(9999),
  sold: z.number().int().min(1).max(9999),
  item_name: z.string().trim().min(1).max(120),
  price: z.number().int().min(1).max(99_999_999),
}).refine((b) => b.sold <= b.from, "You can’t have sold more than you had listed.");

/**
 * "I sold some of these": lowers the order's quantity (removing the order if none are left), and records the sale in your Sales log so the profit and
 * earnings pages count it. The order's saved snapshot is updated too, so it isn't flagged again as a probable sale.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!idOk(id) || !wfmConfigured()) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the numbers." }, { status: 400 });
  const { from, sold, item_name, price } = parsed.data;
  const left = from - sold;
  try {
    const res = left > 0
      ? await wfmAuthedV2(auth.user.id, `/v2/order/${id}`, { method: "PATCH", body: JSON.stringify({ quantity: left }) })
      : await wfmAuthedV2(auth.user.id, `/v2/order/${id}`, { method: "DELETE" });
    if (!res.ok && !(left <= 0 && res.status === 404)) {
      const codes = flattenErrors(await res.json().catch(() => null));
      return NextResponse.json({ error: codes.length ? `Warframe Market: ${codes.slice(0, 2).join(", ")}` : `Warframe Market couldn’t update that order (HTTP ${res.status}).` }, { status: res.status === 429 ? 429 : 422 });
    }
    await auth.sb.from("sales_log").insert({ user_id: auth.user.id, item_name, slug: BY_NAME.get(item_name.toLowerCase()) ?? null, qty: sold, price_each: price, sold_at: new Date().toISOString(), source: "manual", status: "confirmed" });
    if (left > 0) await auth.sb.from("order_snapshots").update({ qty: left }).eq("order_id", id); else await auth.sb.from("order_snapshots").delete().eq("order_id", id);
    return NextResponse.json({ ok: true, left });
  } catch (e) {
    if (e instanceof ReauthRequired) return NextResponse.json({ error: e.message, reauth: true }, { status: 401 });
    return NextResponse.json({ error: "Could not reach Warframe Market." }, { status: 502 });
  }
}
