import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { wfmRequest } from "@/lib/wfm/client";
import { refreshItemBatch } from "@/lib/primes/refresh";
import primes from "../../../../../../data/primes.json";
import type { PrimeCatalogue } from "@/lib/primes/types";

const UNIVERSE = (primes as unknown as PrimeCatalogue).parts.map((p) => p.slug);

export const maxDuration = 60;

/** Same contract as the arcane refresher: refreshes the stalest Prime part / set prices a few at a time and reports what's left. */
let running: Promise<unknown> | null = null;

export async function POST() {
  if (running) return NextResponse.json({ busy: true }, { status: 202 });
  try {
    const sb = createAdminClient();
    running = refreshItemBatch(sb, (path) => wfmRequest(path), UNIVERSE);
    return NextResponse.json(await running);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Price refresh failed" }, { status: 502 });
  } finally {
    running = null;
  }
}
