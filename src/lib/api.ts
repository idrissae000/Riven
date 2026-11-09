import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Resolves the signed-in user for a route handler or returns a 401 response. */
export async function requireUser() {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) } as const;
  return { sb, user: data.user } as const;
}

export const noStore = { headers: { "Cache-Control": "no-store" } };
