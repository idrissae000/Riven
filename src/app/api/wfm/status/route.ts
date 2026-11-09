import { NextResponse } from "next/server";
import { requireUser, noStore } from "@/lib/api";
import { sessionInfo, wfmConfigured } from "@/lib/wfm/auth";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!wfmConfigured()) return NextResponse.json({ configured: false, connected: false }, noStore);
  return NextResponse.json({ configured: true, ...(await sessionInfo(auth.user.id)) }, noStore);
}
