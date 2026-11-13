import "server-only";
import { createClient } from "@/lib/supabase/server";
import { primeCatalogue } from "@/lib/primes/catalogue";

const PRIME = new Set(primeCatalogue.parts.map((p) => p.slug));

/** Resolves an inventory item to its Warframe Market slug and the rank its listings must be at; null = not a tradable item we know. */
export async function resolveItem(kind: string, slug: string, rank: number): Promise<{ wfm: string; rank: number } | null> {
  if (kind === "prime") return PRIME.has(slug) && rank === 0 ? { wfm: slug, rank: 0 } : null;
  if (kind === "arcane") {
    const { data } = await (await createClient()).from("arcanes").select("wfm_slug,max_rank").eq("slug", slug).maybeSingle();
    if (!data?.wfm_slug || (rank !== 0 && rank !== data.max_rank)) return null;
    return { wfm: data.wfm_slug as string, rank };
  }
  // any Warframe Market item (for the listings manager): the slug goes straight to WFM, so keep it to safe characters
  if (kind === "item") return /^[a-z0-9_]{1,80}$/.test(slug) && rank >= 0 && rank <= 10 ? { wfm: slug, rank } : null;
  return null;
}
