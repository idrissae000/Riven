import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Riven, RivenAttribute, Weapon } from "@/lib/types";

export async function getReferenceData() {
  const sb = await createClient();
  const [w, a] = await Promise.all([
    sb.from("weapons").select("slug,name,riven_type,group_name,req_mastery,icon").order("name"),
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

export interface ArcanePriceRow { slug: string; low: number | null; avg5: number | null; listings: number; max_low: number | null; max_avg5: number | null; max_listings: number; fetched_at: string | null; volume_48h: number | null; sold_avg_48h: number | null; stats_at: string | null }

/** Latest rank-0 market price row per arcane (refreshed in the background by /api/arcanes/prices/refresh). */
export async function listArcanePrices(): Promise<ArcanePriceRow[]> {
  const sb = await createClient();
  const { data } = await sb.from("arcane_prices").select("slug,low,avg5,listings,max_low,max_avg5,max_listings,fetched_at,volume_48h,sold_avg_48h,stats_at");
  // numeric columns arrive as strings from PostgREST in some configurations; normalise
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    slug: r.slug as string, low: r.low as number | null, avg5: r.avg5 == null ? null : Number(r.avg5), listings: Number(r.listings ?? 0),
    max_low: r.max_low as number | null, max_avg5: r.max_avg5 == null ? null : Number(r.max_avg5), max_listings: Number(r.max_listings ?? 0),
    fetched_at: (r.fetched_at as string | null) ?? null, volume_48h: r.volume_48h == null ? null : Number(r.volume_48h),
    sold_avg_48h: r.sold_avg_48h == null ? null : Number(r.sold_avg_48h), stats_at: (r.stats_at as string | null) ?? null,
  }));
}

export interface ArcaneCollectionRow { id: string; name: string; vosfor: number; credits: number; picks: number; tiers: { rarity: "Common" | "Uncommon" | "Rare" | "Legendary"; chance: number; arcanes: string[] }[] }

export async function listArcaneCollections(): Promise<ArcaneCollectionRow[]> {
  const sb = await createClient();
  const { data } = await sb.from("arcane_collections").select("id,name,vosfor,credits,picks,tiers").order("name");
  return (data ?? []) as ArcaneCollectionRow[];
}

export async function getArcane(slug: string): Promise<ArcaneRow | null> {
  const sb = await createClient();
  const { data } = await sb.from("arcanes").select("*").eq("slug", slug).maybeSingle();
  return (data as ArcaneRow | null) ?? null;
}
