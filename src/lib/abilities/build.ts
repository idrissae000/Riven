import { slugify } from "@/lib/arcanes/build";

/** The ability-scaling stats arcanes can boost, as the wiki names them -> readable label. */
export const ABILITY_MODIFIERS: Record<string, string> = {
  AVATAR_ABILITY_STRENGTH: "Ability Strength",
  AVATAR_ABILITY_DURATION: "Ability Duration",
  AVATAR_ABILITY_EFFICIENCY: "Ability Efficiency",
  AVATAR_ABILITY_RANGE: "Ability Range",
};

export interface LuaAbility {
  Name?: string; Powersuit?: string; Key?: number; Cost?: number; Subsumable?: boolean; InternalName?: string; Description?: string;
}
type StatLine = { Modifier?: string };

/** One row of the `abilities` table. */
export interface AbilityRecord {
  slug: string;
  name: string;
  warframe: string;       // the Warframe (or Necramech/Archwing) this ability belongs to
  key: number | null;     // ability slot 1-4
  cost: number | null;
  helminth: boolean;      // true = can be subsumed onto the Helminth (shown with a star)
  modifiers: string[];    // which ability stats it scales with (subset of ABILITY_MODIFIERS keys)
  internal_name: string | null;
}

export function buildAbilities(
  abilities: Record<string, LuaAbility>,
  stats: Record<string, StatLine[] | Record<string, StatLine>>,
): AbilityRecord[] {
  // The stats module keys abilities by e.g. /Lotus/Powersuits/PowersuitAbilities/RhinoRoarAbility while the
  // ability list uses /Lotus/Powersuits/Rhino/Abilities/RhinoRoarAbility — only the last segment is shared.
  const base = (path: string) => path.slice(path.lastIndexOf("/") + 1);
  const byBase = new Map<string, StatLine[]>();
  for (const [path, lines] of Object.entries(stats)) byBase.set(base(path), [...(byBase.get(base(path)) ?? []), ...Object.values(lines)]);

  const out: AbilityRecord[] = [];
  for (const [key, a] of Object.entries(abilities)) {
    const name = a.Name ?? key;
    if (!a.Powersuit) continue; // can't attribute it to a Warframe
    const lines = a.InternalName ? byBase.get(base(a.InternalName)) ?? [] : [];
    const modifiers = [...new Set(lines.map((l) => l.Modifier).filter((m): m is string => !!m && m in ABILITY_MODIFIERS))].sort();
    out.push({
      slug: slugify(`${a.Powersuit}_${name}`),
      name,
      warframe: a.Powersuit,
      key: a.Key ?? null,
      cost: a.Cost ?? null,
      helminth: a.Subsumable === true,
      modifiers,
      internal_name: a.InternalName ?? null,
    });
  }
  // Some Warframes have the same ability name on several slots (e.g. Drifter's Restorative): keep slugs unique.
  const seen = new Map<string, number>();
  for (const r of out) seen.set(r.slug, (seen.get(r.slug) ?? 0) + 1);
  for (const r of out) if ((seen.get(r.slug) ?? 0) > 1) r.slug = `${r.slug}_slot${r.key ?? 0}`;
  return out.sort((x, y) => x.name.localeCompare(y.name) || x.warframe.localeCompare(y.warframe));
}

/** Display form the UI uses: "Roar (Rhino)" and a trailing ★ for Helminth-subsumable abilities. */
export function abilityLabel(a: Pick<AbilityRecord, "name" | "warframe" | "helminth">): string {
  return `${a.name} (${a.warframe})${a.helminth ? " ★" : ""}`;
}

/** Arcane stat keys (wiki UpgradeTypes) -> the ability modifiers they boost. */
export function modifiersFor(upgradeTypeKeys: string[]): string[] {
  return upgradeTypeKeys.filter((k) => k in ABILITY_MODIFIERS);
}
