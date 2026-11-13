import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ALLOWED_TYPES, MAX_BYTES, ScanFailed, ScanRefused, type AllowedType } from "@/lib/ocr/extract";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { matchRead } from "@/lib/primes/scan-match";
import { readInventoryImage } from "@/lib/primes/scan-read";

export const maxDuration = 60;

// Open to everyone, but every image costs real API credits, so it is rate limited.
const PER_VISITOR = { limit: 20, windowMs: 10 * 60 * 1000 };
const GLOBAL_PER_DAY = Number(process.env.SCAN_DAILY_LIMIT) || 300;

/** One inventory screenshot -> the Prime parts + counts read from it (matched to the catalogue). Nothing is saved. */
export async function POST(request: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  const visitor = auth.user ? `user:${auth.user.id}` : `ip:${clientIp(request.headers)}`;
  const mine = rateLimit(`inv-scan:${visitor}`, PER_VISITOR.limit, PER_VISITOR.windowMs);
  if (!mine.ok) return NextResponse.json({ error: `Easy there — you can scan ${PER_VISITOR.limit} images per 10 minutes. Try again in ${Math.ceil(mine.retryAfterSec / 60)} min.` }, { status: 429, headers: { "Retry-After": String(mine.retryAfterSec) } });
  if (!rateLimit("inv-scan:global", GLOBAL_PER_DAY, 24 * 60 * 60 * 1000).ok) return NextResponse.json({ error: "Scanning is at its daily limit. You can still add items by hand." }, { status: 429 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Screenshot scanning needs ANTHROPIC_API_KEY set on the server." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach an image." }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) return NextResponse.json({ error: "Use a PNG, JPEG or WebP image." }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That image is too large to upload." }, { status: 413 });

  try {
    const read = await readInventoryImage(Buffer.from(await file.arrayBuffer()), file.type as AllowedType, form?.get("mode") === "rewards" ? "rewards" : "inventory");
    return NextResponse.json({ ...matchRead(read.items, primeCatalogue.parts), notes: read.notes, readCount: read.items.length });
  } catch (e) {
    if (e instanceof ScanRefused || e instanceof ScanFailed) return NextResponse.json({ error: e.message }, { status: 422 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "Scan service is busy — try again shortly." }, { status: 429 });
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "The server’s Anthropic API key was rejected." }, { status: 502 });
    console.error("[inv-scan] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Scan failed unexpectedly. Try again, or add items by hand." }, { status: 500 });
  }
}
