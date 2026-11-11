import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { wfmRequest } from "@/lib/wfm/client";
import { refreshArcaneBatch } from "@/lib/arcanes/refresh";

/**
 * Refreshes the most out-of-date arcane prices (a few per call) and reports what's left, so a page can keep calling
 * until everything is current. Public on purpose (guests browse arcanes too): it only ever refreshes what's stale,
 * in small batches through the shared Warframe Market throttle, and the caller can't choose what to fetch.
 */
let running: Promise<unknown> | null = null;

export async function POST() {
  if (running) return NextResponse.json({ busy: true }, { status: 202 });
  try {
    const sb = createAdminClient();
    running = refreshArcaneBatch(sb, (path) => wfmRequest(path));
    const result = await running;
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Price refresh failed" }, { status: 502 });
  } finally {
    running = null;
  }
}
