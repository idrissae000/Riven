import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/api";
import { ALLOWED_TYPES, MAX_BYTES, ScanRefused, scanRivenScreenshot, type AllowedType } from "@/lib/ocr/extract";
import { mapScan } from "@/lib/ocr/map";
import type { RivenAttribute, Weapon } from "@/lib/types";

export const maxDuration = 60;

/** Riven screenshot -> prefilled form values. Nothing is saved; the user reviews and saves via the normal form. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "Screenshot scanning needs ANTHROPIC_API_KEY set on the server." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach an image." }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) return NextResponse.json({ error: "Use a PNG, JPEG or WebP screenshot." }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is over 5 MB — crop to the riven card." }, { status: 413 });

  try {
    const scan = await scanRivenScreenshot(Buffer.from(await file.arrayBuffer()), file.type as AllowedType);
    const [w, a] = await Promise.all([
      auth.sb.from("weapons").select("slug,name,riven_type,group_name,disposition,req_mastery,icon"),
      auth.sb.from("riven_attributes").select("slug,name,unit,exclusive_to,positive_only,inverted,prefix,suffix"),
    ]);
    return NextResponse.json(mapScan(scan, (w.data ?? []) as Weapon[], (a.data ?? []) as RivenAttribute[]));
  } catch (e) {
    if (e instanceof ScanRefused) return NextResponse.json({ error: e.message }, { status: 422 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "Scan service is busy — try again shortly." }, { status: 429 });
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "The server’s Anthropic API key was rejected." }, { status: 502 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: `Scan failed (${e.status}).` }, { status: 502 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Scan failed." }, { status: 500 });
  }
}
