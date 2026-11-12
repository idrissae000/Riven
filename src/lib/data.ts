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

export interface ItemPriceRow { slug: string; low: number | null; avg5: number | null; listings: number; fetched_at: string | null }

/** Latest prices for Prime parts / sets (refreshed in the background by /api/primes/prices/refresh). */
export async function listItemPrices(): Promise<ItemPriceRow[]> {
  const sb = await createClient();
  const { data } = await sb.from("item_prices").select("slug,low,avg5,listings,fetched_at").limit(5000);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    slug: r.slug as string, low: r.low as number | null, avg5: r.avg5 == null ? null : Number(r.avg5), listings: Number(r.listings ?? 0), fetched_at: (r.fetched_at as string | null) ?? null,
  }));
}

export interface WeaponRivenRow { slug: string; listings: number; saturated: boolean; low: number | null; median: number | null; p75: number | null; stats: { stat: string; withMedian: number; withoutMedian: number; n: number }[]; fetched_at: string | null }

/** Per-weapon riven market summaries (refreshed in the background by /api/weapons/prices/refresh). */
export async function listWeaponRivenPrices(): Promise<WeaponRivenRow[]> {
  const sb = await createClient();
  const { data } = await sb.from("weapon_riven_prices").select("slug,listings,saturated,low,median,p75,stats,fetched_at").limit(2000);
  return (data ?? []) as WeaponRivenRow[];
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

/** Daily price points for the last `days` days, per slug (arcanes: unranked price; Prime parts: average of the 5 cheapest listings). */
export async function listPriceHistory(days = 30): Promise<Map<string, { day: string; price: number }[]>> {
  const sb = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await sb.from("price_history").select("slug,day,price").gte("day", since).limit(50_000);
  const out = new Map<string, { day: string; price: number }[]>();
  for (const r of (data ?? []) as { slug: string; day: string; price: number | string }[]) {
    const list = out.get(r.slug) ?? [];
    list.push({ day: r.day, price: Number(r.price) });
    out.set(r.slug, list);
  }
  return out;
}

/** Everything the price chart needs for one item: 90 days of real sales + our own daily asking-price snapshots. */
export async function getItemHistory(slug: string, days = 90) {
  const sb = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const [s, a] = await Promise.all([
    sb.from("sales_history").select("day,avg_price,min_price,max_price,volume").eq("slug", slug).gte("day", since).order("day"),
    sb.from("price_history").select("day,price,listings").eq("slug", slug).gte("day", since).order("day"),
  ]);
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    sales: ((s.data ?? []) as Record<string, unknown>[]).map((r) => ({ day: r.day as string, avg: Number(r.avg_price), min: n(r.min_price), max: n(r.max_price), volume: Number(r.volume ?? 0) })),
    asking: ((a.data ?? []) as Record<string, unknown>[]).map((r) => ({ day: r.day as string, price: Number(r.price), listings: Number(r.listings ?? 0) })),
  };
}
