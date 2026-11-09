import { extractAbilityLists, extractCompatNotes, extractDropSources, type AbilityList, type DropSource } from "@/lib/wiki/wikitext";
import { cleanWikitext } from "@/lib/wiki/wikitext";

export interface UpgradeTypeInfo { label: string; category: string; hidden?: boolean }
export type UpgradeTypeMap = Record<string, UpgradeTypeInfo | string>;

/** One row of the `arcanes` table. */
export interface ArcaneRecord {
  slug: string;
  name: string;
  slot: string;               // Warframe | Operator | Primary | Secondary | Melee | Amp | Zaw | Kitgun | ...
  rarity: string | null;
  max_rank: number | null;
  description: string;
  effect_stats: { key: string; label: string; category: string }[];
  compatibility: Compatibility;
  drop_sources: DropSource[];
  wiki_title: string;
  wiki_url: string;
  wiki_revid: number | null;
  wiki_icon: string | null;
  introduced: string | null;
  wfm_slug: string | null;
  needs_review: string[];     // human-readable flags from the sync (e.g. "no drop sources on wiki")
  overridden_fields: string[];
}

export interface Compatibility {
  /** Gear slot this arcane is equipped on. */
  equips_on: string;
  /** What it scales / affects, as readable labels (derived from the wiki's UpgradeTypes). */
  scales_with: string[];
  /** Coarse buckets for filtering: abilities | weapons | melee | survivability | movement | utility. */
  categories: string[];
  /** True when the arcane's effect scales with ability stats (Strength/Duration/Efficiency/Energy). */
  ability_scaling: boolean;
  requires: string[];
  excludes: string[];
  /** Wiki Notes/Tips that talk about compatibility. */
  notes: string[];
  /** Per-ability compatibility — filled from data/arcane-overrides.json. */
  abilities: { name: string; affected: boolean; note?: string }[];
  playstyles: string[];
  /** Per-ability lists parsed from the arcane's wiki page (e.g. Arcane Sculptor's Valid / Invalid Objects). */
  ability_lists: AbilityList[];
}

export const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const humanize = (tag: string) => tag.toLowerCase().split("_").map((w, i) => (i ? w : w[0].toUpperCase() + w.slice(1))).join(" ");

const TAG_LABELS: Record<string, string> = {
  OPERATOR_SUIT: "Operator suit (Void Mode)",
  POWER_WEAPON: "Exalted / power weapons",
};

export interface LuaArcane {
  Name?: string; Link?: string; Type?: string; Rarity?: string; MaxRank?: number; Description?: string; Icon?: string;
  Introduced?: string; UpgradeTypes?: string[]; IncompatibilityTags?: string[]; CompatibilityTags?: string[];
}

export interface Overrides { description?: string; compatibility?: Partial<Compatibility>; drop_sources?: DropSource[] }

export function buildArcane(
  lua: LuaArcane,
  wikitext: string | null,
  revid: number | null,
  upgradeMap: UpgradeTypeMap,
  override: Overrides | undefined,
  unmapped: Set<string>,
  helminthOf?: (warframe: string, ability: string) => boolean | undefined,
): ArcaneRecord {
  const name = lua.Name ?? lua.Link ?? "";
  const title = lua.Link ?? name;
  const needs: string[] = [];

  const effect_stats = (lua.UpgradeTypes ?? []).map((key) => {
    const m = upgradeMap[key];
    const info = typeof m === "object" ? m : null;
    if (!info) unmapped.add(key);
    return { key, label: info?.label ?? humanize(key.replace(/^(AVATAR|WEAPON|GAMEPLAY)_/, "")), category: info?.category ?? "other", hidden: !!info?.hidden };
  });
  const shown = effect_stats.filter((e) => !e.hidden);
  const categories = [...new Set(shown.map((e) => e.category))];

  const drop_sources = wikitext ? extractDropSources(wikitext, title) : [];
  if (drop_sources.length === 0) needs.push("no drop sources found on the wiki page");

  const compatibility: Compatibility = {
    equips_on: lua.Type ?? "Unknown",
    scales_with: shown.map((e) => e.label),
    categories,
    ability_scaling: shown.some((e) => e.category === "abilities"),
    requires: (lua.CompatibilityTags ?? []).map((t) => TAG_LABELS[t] ?? humanize(t)),
    excludes: (lua.IncompatibilityTags ?? []).map((t) => TAG_LABELS[t] ?? humanize(t)),
    notes: wikitext ? extractCompatNotes(wikitext, title) : [],
    abilities: [],
    playstyles: [],
    ability_lists: wikitext ? extractAbilityLists(wikitext, title, helminthOf) : [],
  };
  if (shown.length === 0) needs.push("wiki lists no scaling stats (compatibility is Type + notes only)");

  const overridden: string[] = [];
  let description = cleanWikitext(lua.Description ?? "", title).replace(/\r/g, "");
  let drops = drop_sources;
  if (override) {
    if (override.description) { description = override.description; overridden.push("description"); }
    if (override.compatibility) { Object.assign(compatibility, override.compatibility); overridden.push("compatibility"); }
    if (override.drop_sources) { drops = override.drop_sources; overridden.push("drop_sources"); }
  }

  return {
    slug: slugify(name),
    name,
    slot: lua.Type ?? "Unknown",
    rarity: lua.Rarity ?? null,
    max_rank: lua.MaxRank ?? null,
    description,
    effect_stats: effect_stats.map(({ key, label, category }) => ({ key, label, category })),
    compatibility,
    drop_sources: drops,
    wiki_title: title,
    wiki_url: `https://wiki.warframe.com/w/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    wiki_revid: revid,
    wiki_icon: lua.Icon ?? null,
    introduced: lua.Introduced ?? null,
    wfm_slug: null,
    needs_review: needs,
    overridden_fields: overridden,
  };
}
