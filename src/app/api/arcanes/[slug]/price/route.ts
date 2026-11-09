import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { priceArcane } from "@/lib/arcanes/price";
import { WfmError } from "@/lib/wfm/client";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await createClient();
  const { data: arcane } = await sb.from("arcanes").select("wfm_slug,max_rank").eq("slug", slug).maybeSingle();
  if (!arcane) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!arcane.wfm_slug) return NextResponse.json({ error: "This arcane isn’t tradable on Warframe Market." }, { status: 404 });
  try {
    const force = new URL(request.url).searchParams.get("refresh") === "1";
    const r = await priceArcane(arcane.wfm_slug, arcane.max_rank, { force });
    return NextResponse.json({ ...r.data, fetchedAt: r.fetchedAt, fromCache: r.fromCache, stale: r.stale });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Price lookup failed" }, { status: e instanceof WfmError && e.status === 429 ? 429 : 502 });
  }
}
