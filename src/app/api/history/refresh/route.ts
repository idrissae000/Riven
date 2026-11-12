import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { wfmRequest } from "@/lib/wfm/client";
import { refreshSalesBatch } from "@/lib/history-sales";
import primes from "../../../../../data/primes.json";
import type { PrimeCatalogue } from "@/lib/primes/types";

export const maxDuration = 60;

const PARTS = (primes as unknown as PrimeCatalogue).parts.map((p) => ({ slug: p.slug, wfm_slug: p.slug }));

/**
 * Copies Warframe Market's 90-day sales history for the stalest arcanes / Prime parts, a few per call. Public on purpose,
 * like the price refreshers: it only ever refreshes what's stale, in small batches, and the caller can't choose what to fetch.
 */
let running: Promise<unknown> | null = null;

export async function POST(request: Request) {
  if (running) return NextResponse.json({ busy: true }, { status: 202 });
  try {
    const sb = createAdminClient();
    const { data } = await sb.from("arcanes").select("slug,wfm_slug").not("wfm_slug", "is", null);
    const universe = [...((data ?? []) as { slug: string; wfm_slug: string }[]), ...PARTS];
    // ?slug=… = "someone is looking at this item's chart": copy just that one now (still only if it's stale, so it can't be abused)
    const only = new URL(request.url).searchParams.get("slug");
    const picked = only ? universe.filter((u) => u.slug === only) : universe;
    if (only && !picked.length) return NextResponse.json({ error: "Unknown item" }, { status: 404 });
    running = refreshSalesBatch(sb, (path) => wfmRequest(path), picked);
    return NextResponse.json(await running);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "History refresh failed" }, { status: 502 });
  } finally {
    running = null;
  }
}
