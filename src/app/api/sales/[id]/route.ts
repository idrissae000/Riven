import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f-]{36}$/i;
const patch = z.object({
  status: z.enum(["confirmed", "dismissed"]).optional(),
  qty: z.number().int().min(1).max(9999).optional(),
  price_each: z.number().int().min(1).max(99_999_999).optional(),
}).refine((b) => Object.keys(b).length > 0, "Nothing to change");

/** Confirm / dismiss a detected sale, or correct its quantity / price. (RLS: own rows only.) */
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!uuid.test(id) || !parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { error } = await auth.sb.from("sales_log").update(parsed.data).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!uuid.test(id)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { error } = await auth.sb.from("sales_log").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
