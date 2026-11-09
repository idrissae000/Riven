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

import type { GradeRange } from "@/lib/grading/grade";

/** Range rows for the given weapons plus the '*' default. */
export async function getGradeRanges(weaponSlugs: string[]): Promise<GradeRange[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("riven_grade_ranges")
    .select("weapon_slug,stat_slug,is_negative,min_roll,max_roll,is_placeholder")
    .in("weapon_slug", [...new Set([...weaponSlugs, "*"])]);
  return (data ?? []).map((r) => ({ ...r, min_roll: Number(r.min_roll), max_roll: Number(r.max_roll) })) as GradeRange[];
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

export interface AbilityRow { slug: string; name: string; warframe: string; key: number | null; helminth: boolean; modifiers: string[] }

/** Abilities that scale with ANY of the given ability stats (e.g. AVATAR_ABILITY_STRENGTH), plus how many have no stat data. */
export async function getAbilitiesScalingWith(modifiers: string[]): Promise<{ abilities: AbilityRow[]; unknownCount: number }> {
  if (modifiers.length === 0) return { abilities: [], unknownCount: 0 };
  const sb = await createClient();
  const [hit, unknown] = await Promise.all([
    sb.from("abilities").select("slug,name,warframe,key,helminth,modifiers").overlaps("modifiers", modifiers).order("name").limit(1000),
    sb.from("abilities").select("slug", { count: "exact", head: true }).eq("modifiers", "{}"),
  ]);
  return { abilities: (hit.data ?? []) as AbilityRow[], unknownCount: unknown.count ?? 0 };
}
