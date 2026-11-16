import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";

const add = z.object({ slug: z.string().trim().min(1).max(120), kind: z.enum(["prime", "arcane"]), name: z.string().trim().min(1).max(120) });

/** Add an item to the signed-in user's watchlist. (RLS: own rows only.) */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = add.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick an item from the list." }, { status: 400 });
  const { count } = await auth.sb.from("watchlist").select("slug", { count: "exact", head: true });
  if ((count ?? 0) >= 60) return NextResponse.json({ error: "Your watchlist is full (60 items)." }, { status: 400 });
  const { error } = await auth.sb.from("watchlist").upsert({ user_id: auth.user.id, ...parsed.data }, { onConflict: "user_id,slug" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing item." }, { status: 400 });
  const { error } = await auth.sb.from("watchlist").delete().eq("slug", slug);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
