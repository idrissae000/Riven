import { NextResponse } from "next/server";
import { computeInsights, insightsDue } from "@/lib/insights/compute";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

let running: Promise<unknown> | null = null;

/** Driven by the hourly cron; does the (heavier) daily accuracy and weekday work only when it's a day old. */
export async function POST() {
  if (running) return NextResponse.json({ busy: true }, { status: 202 });
  try {
    const sb = createAdminClient();
    if (!(await insightsDue(sb))) return NextResponse.json({ fresh: true });
    running = computeInsights(sb);
    return NextResponse.json(await running);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Insights refresh failed" }, { status: 502 });
  } finally {
    running = null;
  }
}
