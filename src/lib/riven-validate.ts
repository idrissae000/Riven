import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { RivenInput } from "@/lib/riven-schema";
import { validateStatSigns } from "@/lib/stat-sign";

/** Checks stat signs/roles against riven_attributes. Returns an error message or null. */
export async function checkRivenSigns(
  sb: Awaited<ReturnType<typeof createClient>>,
  stats: RivenInput["stats"],
): Promise<string | null> {
  const { data } = await sb.from("riven_attributes").select("slug,name,unit,inverted,positive_only").in("slug", stats.map((s) => s.stat));
  return validateStatSigns(stats, new Map((data ?? []).map((a) => [a.slug, a])));
}
