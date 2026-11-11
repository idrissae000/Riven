import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inventoryQtySchema } from "@/lib/inventory/schema";

// RLS guarantees each user can only touch their own rows.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = inventoryQtySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid quantity" }, { status: 400 });
  const sb = await createClient();
  if (!(await sb.auth.getUser()).data.user) return NextResponse.json({ error: "Sign in to track your inventory." }, { status: 401 });
  const { data, error } = await sb.from("inventory_items").update({ qty: parsed.data.qty }).eq("id", id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: data.id });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  if (!(await sb.auth.getUser()).data.user) return NextResponse.json({ error: "Sign in to track your inventory." }, { status: 401 });
  const { error } = await sb.from("inventory_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
