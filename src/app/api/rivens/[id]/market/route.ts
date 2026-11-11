import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGradingData } from "@/lib/data";
import { priceRiven } from "@/lib/wfm/pricing";
import { WfmError } from "@/lib/wfm/client";
import type { Riven, RivenAttribute } from "@/lib/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: riven } = await sb.from("rivens").select("*").eq("id", id).maybeSingle(); // RLS: own rows only
  if (!riven) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [{ data: attrs }, { data: weapon }, gradingData] = await Promise.all([
    sb.from("riven_attributes").select("slug,name,unit,exclusive_to,positive_only,inverted,prefix,suffix"),
    sb.from("weapons").select("name,riven_type,group_name").eq("slug", riven.weapon_slug).maybeSingle(),
    getGradingData(),
  ]);

  try {
    const force = new URL(request.url).searchParams.get("refresh") === "1";
    const result = await priceRiven(riven as Riven, (attrs ?? []) as RivenAttribute[], { force, grading: weapon ? { weapon, data: gradingData } : undefined });
    // Remember the estimate so My Rivens can show it instantly (RLS: the owner's own row). Never blocks the response on failure.
    const e = result.estimate;
    await sb.from("rivens").update({
      est_low: e?.low ?? null, est_median: e?.median ?? null, est_high: e?.high ?? null,
      est_confidence: e?.confidence ?? null, est_samples: e?.sampleSize ?? null, est_at: new Date().toISOString(),
    }).eq("id", id);
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof WfmError && e.status === 429 ? 429 : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Market lookup failed" }, { status });
  }
}
