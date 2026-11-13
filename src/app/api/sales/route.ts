import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { primeCatalogue } from "@/lib/primes/catalogue";

const body = z.object({
  item_name: z.string().trim().min(1, "Enter what you sold").max(120),
  qty: z.number().int().min(1).max(9999),
  price_each: z.number().int().min(1).max(99_999_999),
  sold_at: z.string().datetime().optional(),
});
const BY_NAME = new Map(primeCatalogue.parts.map((p) => [p.name.toLowerCase(), p.slug]));

/** Log a sale by hand. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the item, quantity and price." }, { status: 400 });
  const { item_name, qty, price_each, sold_at } = parsed.data;
  const { data, error } = await auth.sb.from("sales_log").insert({ user_id: auth.user.id, item_name, slug: BY_NAME.get(item_name.toLowerCase()) ?? null, qty, price_each, sold_at: sold_at ?? new Date().toISOString(), source: "manual", status: "confirmed" }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
