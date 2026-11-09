import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decodeRiven } from "@/lib/riven-share";
import { priceRiven } from "@/lib/wfm/pricing";
import { WfmError } from "@/lib/wfm/client";
import type { Riven, RivenAttribute } from "@/lib/types";

/**
 * Market estimate for an UNSAVED riven (encoded in `r`) — works without an account.
 * Public on purpose, so it is protected the same way as every WFM call: shared throttle + 12-min cache
 * (the cache key is the Warframe Market query, so repeated checks of similar rivens are cache hits).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const riven = decodeRiven(url.searchParams.get("r") ?? undefined);
  if (!riven) return NextResponse.json({ error: "Invalid riven." }, { status: 400 });

  const sb = await createClient();
  const [{ data: weapon }, { data: attrs }] = await Promise.all([
    sb.from("weapons").select("slug").eq("slug", riven.weapon_slug).maybeSingle(),
    sb.from("riven_attributes").select("slug,name,unit,exclusive_to,positive_only,inverted,prefix,suffix"),
  ]);
  if (!weapon) return NextResponse.json({ error: "Unknown weapon." }, { status: 404 });

  try {
    const full = { ...riven, id: "guest", user_id: "", created_at: "", updated_at: "" } as unknown as Riven;
    const result = await priceRiven(full, (attrs ?? []) as RivenAttribute[], { force: url.searchParams.get("refresh") === "1" });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Market lookup failed" }, { status: e instanceof WfmError && e.status === 429 ? 429 : 502 });
  }
}
