import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { clearSession, wfmConfigured } from "@/lib/wfm/auth";

/** Forget the stored WFM token (the user can always disconnect). */
export async function POST() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (wfmConfigured()) await clearSession(auth.user.id);
  return NextResponse.json({ connected: false });
}
