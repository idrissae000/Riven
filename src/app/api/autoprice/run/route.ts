import { NextResponse } from "next/server";
import { runAutoprice } from "@/lib/autoprice/run";
import { createAdminClient } from "@/lib/supabase/admin";
import { wfmConfigured } from "@/lib/wfm/auth";

export const maxDuration = 60;

let running: Promise<unknown> | null = null;

/** Driven by the minute cron: reprices the sell orders of users who switched auto-repricing on. Each user is touched at most every 10 minutes. */
export async function POST() {
  if (!wfmConfigured()) return NextResponse.json({ skipped: "not configured" });
  if (running) return NextResponse.json({ busy: true }, { status: 202 });
  try {
    running = runAutoprice(createAdminClient());
    return NextResponse.json(await running);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Auto-reprice failed" }, { status: 502 });
  } finally {
    running = null;
  }
}
