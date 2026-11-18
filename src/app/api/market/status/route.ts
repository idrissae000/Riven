import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { ReauthRequired, wfmConfigured } from "@/lib/wfm/auth";
import { readStatus, setStatus, StatusError, STATUSES } from "@/lib/wfm/status";

const body = z.object({
  status: z.enum(STATUSES as [string, ...string[]]),
  /** how long it lasts, in seconds; 0 / missing = until you change it */
  duration: z.number().int().min(0).max(24 * 3600).optional(),
});

/** Your current Warframe Market status (invisible / online / online in game), or null if it couldn't be read. */
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!wfmConfigured()) return NextResponse.json({ status: null });
  return NextResponse.json({ status: await readStatus(auth.user.id) }, { headers: { "Cache-Control": "no-store" } });
}

/** Change your Warframe Market status. */
export async function PUT(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!wfmConfigured()) return NextResponse.json({ error: "Not configured." }, { status: 400 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick invisible, online or online in game." }, { status: 400 });
  if (!rateLimit(`wfm-status:${auth.user.id}`, 20, 10 * 60_000).ok) return NextResponse.json({ error: "That’s a lot of status changes — wait a few minutes." }, { status: 429 });
  try {
    await setStatus(auth.user.id, parsed.data.status as "invisible" | "online" | "ingame", parsed.data.duration || undefined);
    return NextResponse.json({ ok: true, status: parsed.data.status });
  } catch (e) {
    if (e instanceof ReauthRequired) return NextResponse.json({ error: e.message, reauth: true }, { status: 401 });
    if (e instanceof StatusError) return NextResponse.json({ error: e.message }, { status: 502 });
    return NextResponse.json({ error: "Couldn’t change your status." }, { status: 502 });
  }
}
