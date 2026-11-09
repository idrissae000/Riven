import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rivenInputSchema } from "@/lib/riven-schema";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const sb = await createClient();
  const parsed = rivenInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid riven" }, { status: 400 });
  // RLS guarantees we can only touch our own rows.
  const { data, error } = await sb.from("rivens").update(parsed.data).eq("id", id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: data.id });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const sb = await createClient();
  const { error } = await sb.from("rivens").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
