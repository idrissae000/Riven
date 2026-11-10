import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Riven, RivenAttribute, Weapon } from "@/lib/types";

export async function getReferenceData() {
  const sb = await createClient();
  const [w, a] = await Promise.all([
    sb.from("weapons").select("slug,name,riven_type,group_name,disposition,req_mastery,icon").order("name"),
    sb.from("riven_attributes").select("slug,name,unit,exclusive_to,positive_only,inverted,prefix,suffix").order("name"),
  ]);
  return { weapons: (w.data ?? []) as Weapon[], attributes: (a.data ?? []) as RivenAttribute[] };
}

export async function getRiven(id: string): Promise<Riven | null> {
  const sb = await createClient();
  const { data } = await sb.from("rivens").select("*").eq("id", id).maybeSingle();
  return (data as Riven | null) ?? null;
}

export async function listRivens(): Promise<Riven[]> {
  const sb = await createClient();
  const { data } = await sb.from("rivens").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Riven[];
}

export async function currentUserId(): Promise<string | null> {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

import type { RivenCalcData } from "@/lib/rivencalc/types";
import rivenCalc from "../../data/rivencalc.json";

/**
 * The riven grading data: browse.wf's Riven Calculator, tabulated into data/rivencalc.json by `npm run sync:rivencalc`.
 * It ships with the app (no database round-trip) and is null only if the file is malformed.
 */
export async function getGradingData(): Promise<RivenCalcData | null> {
  const d = rivenCalc as unknown as RivenCalcData;
  const ok = Array.isArray(d.stats) && Array.isArray(d.layouts) && Array.isArray(d.categories) && Array.isArray(d.gradeBands) && d.gradeBands.length > 0 && !!d.ranges && !!d.statSlugs;
  return ok ? d : null;
}

export interface ArcaneRow {
  slug: string; name: string; slot: string; rarity: string | null; max_rank: number | null; description: string;
  effect_stats: { key: string; label: string; category: string }[];
  compatibility: import("@/lib/arcanes/build").Compatibility;
  drop_sources: import("@/lib/wiki/wikitext").DropSource[];
  wiki_title: string; wiki_url: string; wiki_revid: number | null; wfm_slug: string | null; wfm_icon: string | null;
  introduced: string | null; needs_review: string[]; overridden_fields: string[]; synced_at: string;
}

export async function listArcanes(): Promise<ArcaneRow[]> {
  const sb = await createClient();
  const { data } = await sb.from("arcanes").select("*").order("name");
  return (data ?? []) as ArcaneRow[];
}

export async function getArcane(slug: string): Promise<ArcaneRow | null> {
  const sb = await createClient();
  const { data } = await sb.from("arcanes").select("*").eq("slug", slug).maybeSingle();
  return (data as ArcaneRow | null) ?? null;
}
