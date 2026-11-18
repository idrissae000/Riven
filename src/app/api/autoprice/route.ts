import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";

const body = z.object({
  enabled: z.boolean(),
  rule: z.enum(["undercut", "match", "market"]),
  /** blank = no minimum (stored as 1, the lowest price Warframe Market allows) */
  floor: z.number().int().min(1).max(99_999).nullable().default(null).transform((f) => f ?? 1),
  max_drop_pct: z.number().int().min(1).max(50),
  follow_up: z.boolean().default(false),
  ceiling: z.number().int().min(1).max(99_999).nullable().default(null),
}).refine((b) => !b.follow_up || (b.ceiling != null && b.ceiling >= b.floor), "To raise prices again, set the highest price it may go to (at least your lowest price).");

/** Save the signed-in user's auto-repricing settings. (RLS: own row only.) */
export async function PUT(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the settings." }, { status: 400 });
  const { error } = await auth.sb.from("autoprice_settings").upsert({ user_id: auth.user.id, ...parsed.data, note: null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
