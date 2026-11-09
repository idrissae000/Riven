import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rivenInputSchema } from "@/lib/riven-schema";
import { checkRivenSigns } from "@/lib/riven-validate";


export async function GET() {
  const sb = await createClient();
  const { data, error } = await sb.from("rivens").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rivens: data });
}

export async function POST(request: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = rivenInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid riven" }, { status: 400 });

  const signError = await checkRivenSigns(sb, parsed.data.stats);
  if (signError) return NextResponse.json({ error: signError }, { status: 400 });

  const { data, error } = await sb.from("rivens").insert({ ...parsed.data, user_id: auth.user.id }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
