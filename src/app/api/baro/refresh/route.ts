import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { wfmRequest } from "@/lib/wfm/client";
import { itemByName } from "@/lib/wfm/items-index";
import { getWorldState } from "@/lib/worldstate";
import { refreshBaro } from "@/lib/baro/refresh";

export const maxDuration = 60;

/**
 * While Baro Ki'Teer is here: saves his stock and, a few items per call, each tradable item's live price and the price pattern from his
 * past visits. Public like the other refreshers — it only does stale work, in small batches, and the caller chooses nothing.
 */
let running: Promise<unknown> | null = null;

export async function POST() {
  if (running) return NextResponse.json({ busy: true }, { status: 202 });
  try {
    const { state } = await getWorldState();
    const sb = createAdminClient();
    running = refreshBaro(sb, (path) => wfmRequest(path), state?.baro ?? null, async (name) => (await itemByName(name))?.slug ?? null);
    return NextResponse.json(await running);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Baro refresh failed" }, { status: 502 });
  } finally {
    running = null;
  }
}
