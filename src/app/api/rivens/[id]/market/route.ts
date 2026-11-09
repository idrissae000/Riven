import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { priceRiven } from "@/lib/wfm/pricing";
import { WfmError } from "@/lib/wfm/client";
import type { Riven, RivenAttribute } from "@/lib/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: riven } = await sb.from("rivens").select("*").eq("id", id).maybeSingle(); // RLS: own rows only
  if (!riven) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: attrs } = await sb.from("riven_attributes").select("slug,name,unit,exclusive_to,positive_only,prefix,suffix");

  try {
    const force = new URL(request.url).searchParams.get("refresh") === "1";
    const result = await priceRiven(riven as Riven, (attrs ?? []) as RivenAttribute[], { force });
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof WfmError && e.status === 429 ? 429 : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Market lookup failed" }, { status });
  }
}
