import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, noStore } from "@/lib/api";
import { saveSession, signIn, WfmAuthError, wfmConfigured } from "@/lib/wfm/auth";

const body = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

/** Exchanges WFM credentials for a session token, stores ONLY the encrypted token. The password is never logged or kept. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!wfmConfigured())
    return NextResponse.json({ error: "Server isn’t configured for Warframe Market sign-in (WFM_TOKEN_ENCRYPTION_KEY / SUPABASE_SERVICE_ROLE_KEY)." }, { status: 503 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your Warframe Market email and password." }, { status: 400 });

  try {
    const session = await signIn(parsed.data.email, parsed.data.password);
    await saveSession(auth.user.id, session);
    return NextResponse.json({ connected: true, name: session.name, slug: session.slug }, noStore);
  } catch (e) {
    if (e instanceof WfmAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Could not reach Warframe Market." }, { status: 502 });
  }
}
