import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ALLOWED_TYPES, MAX_BYTES, ScanFailed, ScanRefused, locateRivenCard, scanRivenImage, type AllowedType } from "@/lib/ocr/extract";
import { mapScan } from "@/lib/ocr/map";
import type { RivenAttribute, Weapon } from "@/lib/types";

export const maxDuration = 60;

// Open to everyone (no account needed) but every scan costs real API credits, so it is rate limited.
const PER_VISITOR = { limit: 6, windowMs: 10 * 60 * 1000 };
const GLOBAL_PER_DAY = Number(process.env.SCAN_DAILY_LIMIT) || 300; // per server instance

/** Riven screenshot -> prefilled form values. Nothing is saved; the user reviews and saves via the normal form. */
export async function POST(request: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  const visitor = auth.user ? `user:${auth.user.id}` : `ip:${clientIp(request.headers)}`;
  // Big images take two calls: "locate" (cheap) then "read". Only reads count against the visible limit.
  const stage = new URL(request.url).searchParams.get("stage") === "locate" ? "locate" : "read";
  const mine = rateLimit(`scan-${stage}:${visitor}`, stage === "read" ? PER_VISITOR.limit : PER_VISITOR.limit * 2, PER_VISITOR.windowMs);
  if (!mine.ok) return NextResponse.json({ error: `Easy there — you can scan ${PER_VISITOR.limit} images per 10 minutes. Try again in ${Math.ceil(mine.retryAfterSec / 60)} min.` }, { status: 429, headers: { "Retry-After": String(mine.retryAfterSec) } });
  if (!rateLimit(`scan-${stage}:global`, GLOBAL_PER_DAY, 24 * 60 * 60 * 1000).ok)
    return NextResponse.json({ error: "Scanning is at its daily limit. You can still enter the stats by hand." }, { status: 429 });
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "Screenshot scanning needs ANTHROPIC_API_KEY set on the server." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach an image." }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) return NextResponse.json({ error: "Use a PNG, JPEG or WebP image. (HEIC photos: switch your camera to “Most Compatible” or screenshot the photo.)" }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That image is too large to upload — crop it closer to the riven card." }, { status: 413 });

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    if (stage === "locate") return NextResponse.json({ box: await locateRivenCard(bytes, file.type as AllowedType) });
    const scan = await scanRivenImage(bytes, file.type as AllowedType);
    const [w, a] = await Promise.all([
      sb.from("weapons").select("slug,name,riven_type,group_name,req_mastery,icon"),
      sb.from("riven_attributes").select("slug,name,unit,exclusive_to,positive_only,inverted,prefix,suffix"),
    ]);
    return NextResponse.json(mapScan(scan, (w.data ?? []) as Weapon[], (a.data ?? []) as RivenAttribute[]));
  } catch (e) {
    if (e instanceof ScanRefused || e instanceof ScanFailed) return NextResponse.json({ error: e.message }, { status: 422 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "Scan service is busy — try again shortly." }, { status: 429 });
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "The server’s Anthropic API key was rejected." }, { status: 502 });
    console.error("[scan] failed:", e instanceof Error ? e.message : e);
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: `The scan service had a problem (${e.status}). Try again, or enter the stats by hand.` }, { status: 502 });
    return NextResponse.json({ error: "Scan failed unexpectedly. Try again, or enter the stats by hand." }, { status: 500 });
  }
}
