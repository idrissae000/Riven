import type { PartType, PrimeCatalogue, PrimePart, Relic } from "./types";

/** The slice of Warframe Market's `/v2/items` we read. */
export interface WfmItem { slug: string; gameRef: string; tags?: string[]; ducats?: number | null; vaulted?: boolean; i18n: { en: { name: string } } }
/** ExportRelics.json values / ExportRewards.json (manifest → rotations → rewards). */
export interface ExportRelic { era: string; category: string; rewardManifest: string }
export type ExportRewards = Record<string, { type: string; itemCount?: number; rarity: string }[][]>;

const ERAS = ["Lith", "Meso", "Neo", "Axi"] as const;
type Era = (typeof ERAS)[number];

function partType(tags: string[]): PartType {
  if (tags.includes("warframe")) return "warframe";
  if (tags.includes("archwing")) return "archwing";
  if (tags.includes("sentinel") || tags.includes("companion")) return "companion";
  if (tags.includes("primary")) return "primary";
  if (tags.includes("secondary")) return "secondary";
  if (tags.includes("melee")) return "melee";
  return "other";
}

/** "/Lotus/StoreItems/Types/…" (rewards) and "/Lotus/Types/…" (market items) name the same thing. */
const itemRef = (type: string) => type.replace("/StoreItems", "");

/**
 * Builds the catalogue: every Prime part / blueprint / set tradable on Warframe Market, and every Lith–Axi relic with the
 * six things it drops. Throws if the export no longer looks like 3 commons + 2 uncommons + 1 rare per relic.
 */
export function buildPrimes(src: { items: WfmItem[]; relics: Record<string, ExportRelic>; rewards: ExportRewards }): Pick<PrimeCatalogue, "parts" | "relics"> {
  const items = src.items;
  const bySlug = new Map(items.map((i) => [i.slug, i]));
  const byRef = new Map(items.map((i) => [i.gameRef, i]));

  // ---- relics (the export lists each refinement as its own entry; one per era+category is enough) ----
  const seen = new Set<string>();
  const relics: Relic[] = [];
  for (const r of Object.values(src.relics)) {
    if (!(ERAS as readonly string[]).includes(r.era)) continue; // Requiem / Vanguard relics are a different system
    const id = `${r.era}_${r.category}`.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    const rotations = src.rewards[r.rewardManifest];
    const drops = rotations?.[0];
    if (!drops || drops.length !== 6) throw new Error(`Relic ${id}: expected 6 rewards in ${r.rewardManifest}, found ${drops?.length ?? "none"}`);
    const slugs: Record<string, (string | null)[]> = { common: [], uncommon: [], rare: [] };
    for (const d of drops) {
      const rarity = d.rarity.toLowerCase();
      if (!(rarity in slugs)) throw new Error(`Relic ${id}: unknown rarity ${d.rarity}`);
      slugs[rarity].push(byRef.get(itemRef(d.type))?.slug ?? null);
    }
    if (slugs.common.length !== 3 || slugs.uncommon.length !== 2 || slugs.rare.length !== 1) {
      throw new Error(`Relic ${id}: expected 3 common / 2 uncommon / 1 rare, found ${slugs.common.length} / ${slugs.uncommon.length} / ${slugs.rare.length}`);
    }
    const market = bySlug.get(`${id}_relic`);
    relics.push({ id, era: r.era as Era, name: `${r.era} ${r.category}`, vaulted: market?.vaulted ?? false, common: slugs.common, uncommon: slugs.uncommon, rare: slugs.rare[0] });
  }
  relics.sort((a, b) => ERAS.indexOf(a.era) - ERAS.indexOf(b.era) || a.name.localeCompare(b.name, "en", { numeric: true }));

  // ---- parts & sets ----
  const dropsFrom = new Map<string, string[]>();
  for (const r of relics) for (const slug of [...r.common, ...r.uncommon, r.rare]) if (slug && !dropsFrom.get(slug)?.includes(r.id)) dropsFrom.set(slug, [...(dropsFrom.get(slug) ?? []), r.id]);
  const vaultedOf = new Map(relics.map((r) => [r.id, r.vaulted]));

  const parts: PrimePart[] = items
    .filter((i) => i.tags?.includes("prime") && !i.tags.includes("relic"))
    .map((i): PrimePart => {
      const tags = i.tags ?? [];
      const isSet = tags.includes("set");
      const from = dropsFrom.get(i.slug) ?? [];
      const setSlug = isSet ? null : i.slug.replace(/^(.*_prime)_.+$/, "$1_set");
      return {
        slug: i.slug,
        name: i.i18n.en.name,
        kind: isSet ? "set" : "part",
        type: partType(tags),
        ducats: i.ducats ?? null,
        setSlug: setSlug && bySlug.has(setSlug) ? setSlug : null,
        relics: from,
        vaulted: isSet || !from.length ? null : from.every((id) => vaultedOf.get(id)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { parts, relics };
}
