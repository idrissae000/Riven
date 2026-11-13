import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inventoryInputSchema } from "@/lib/inventory/schema";
import { primeCatalogue } from "@/lib/primes/catalogue";

const PRIME_SLUGS = new Set(primeCatalogue.parts.map((p) => p.slug));

/** Add copies of an item to the signed-in user's inventory (adds to the quantity if they already have it). */
export async function POST(request: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in to track your inventory." }, { status: 401 });

  const parsed = inventoryInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid item" }, { status: 400 });
  const { kind, slug, qty } = parsed.data;
  const rank = kind === "prime" ? 0 : parsed.data.rank;

  if (kind === "prime" && !PRIME_SLUGS.has(slug)) return NextResponse.json({ error: "Unknown Prime part." }, { status: 400 });
  if (kind === "arcane") {
    const { data } = await sb.from("arcanes").select("slug,max_rank").eq("slug", slug).maybeSingle();
    if (!data) return NextResponse.json({ error: "Unknown arcane." }, { status: 400 });
    if (rank !== 0 && rank !== data.max_rank) return NextResponse.json({ error: "Arcanes are tracked unranked or at max rank." }, { status: 400 });
  }

  const { data: existing } = await sb.from("inventory_items").select("id,qty").eq("kind", kind).eq("slug", slug).eq("rank", rank).maybeSingle();
  if (existing) {
    const { error } = await sb.from("inventory_items").update({ qty: Math.min(9999, existing.qty + qty) }).eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ id: existing.id });
  }
  const { data, error } = await sb.from("inventory_items").insert({ user_id: auth.user.id, kind, slug, rank, qty }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}

/** Remove everything from the signed-in user's inventory (RLS limits this to their own rows). */
export async function DELETE() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in to track your inventory." }, { status: 401 });
  const { error, count } = await sb.from("inventory_items").delete({ count: "exact" }).eq("user_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ removed: count ?? 0 });
}
