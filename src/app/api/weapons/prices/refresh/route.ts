import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { wfmRequest } from "@/lib/wfm/client";
import { refreshWeaponBatch } from "@/lib/rivens/refresh";

export const maxDuration = 60;

/** Refreshes the stalest weapon riven-market summaries a few at a time and reports what's left (same contract as the other price refreshers). */
let running: Promise<unknown> | null = null;

export async function POST() {
  if (running) return NextResponse.json({ busy: true }, { status: 202 });
  try {
    const sb = createAdminClient();
    running = refreshWeaponBatch(sb, (path) => wfmRequest(path));
    return NextResponse.json(await running);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Price refresh failed" }, { status: 502 });
  } finally {
    running = null;
  }
}
