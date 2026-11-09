import type { RivenAttribute, Weapon } from "@/lib/types";

/** What the vision model returns for one stat line (strings kept as read off the card). */
export interface ScannedStat { name: string; value: number; shown: string; is_curse: boolean }
export interface ScannedRiven {
  weapon_name: string | null;
  riven_name: string | null;
  polarity: "madurai" | "vazarin" | "naramon" | null;
  mastery_rank: number | null;
  rank: number | null;
  rerolls: number | null;
  stats: ScannedStat[];
  notes: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

/** In-game wording -> the wording of WFM's attribute names, where they differ. */
const STAT_ALIASES: Record<string, string> = {
  "damage": "base damage melee damage",
  "melee damage": "base damage melee damage",
  "base damage": "base damage melee damage",
  "fire rate": "fire rate attack speed",
  "attack speed": "fire rate attack speed",
  "damage to grineer": "damage vs grineer",
  "damage to corpus": "damage vs corpus",
  "damage to infested": "damage vs infested",
  "recoil": "weapon recoil",
  "ammo maximum": "ammo maximum",
  "toxin": "toxin damage", "heat": "heat damage", "cold": "cold damage", "electricity": "electric damage", "electric": "electric damage",
  "impact": "impact damage", "puncture": "puncture damage", "slash": "slash damage",
};

export interface MappedStat {
  scanned: ScannedStat;
  attribute: RivenAttribute | null;   // null = could not match; user must pick
  stat: string | null;                // slug
  value: number | null;               // typed magnitude as the form expects (see stat-sign)
  is_negative: boolean;
}

export function matchAttribute(name: string, attrs: RivenAttribute[]): RivenAttribute | null {
  const n = norm(name);
  const target = STAT_ALIASES[n] ?? n;
  const exact = attrs.find((a) => norm(a.name) === target || norm(a.slug.replace(/_/g, " ")) === target);
  if (exact) return exact;
  // Unambiguous containment (e.g. "Weapon Recoil" vs "Recoil", "Critical Hit Chance")
  const loose = attrs.filter((a) => norm(a.name).includes(target) || target.includes(norm(a.name)));
  return loose.length === 1 ? loose[0] : null;
}

export function matchWeapon(name: string | null, weapons: Weapon[]): Weapon | null {
  if (!name) return null;
  const n = norm(name);
  return weapons.find((w) => norm(w.name) === n) ?? null;
}

/**
 * Converts one scanned stat into what the entry form needs. The card shows "x1.54" or "+54%"
 * for faction-damage stats; WFM stores the multiplier, so a percent is converted.
 */
export function mapStat(s: ScannedStat, attrs: RivenAttribute[], weapon: Weapon | null): MappedStat {
  let attribute = matchAttribute(s.name, attrs);
  if (attribute && weapon && attribute.exclusive_to?.length && !attribute.exclusive_to.includes(weapon.riven_type)) attribute = null;
  let value: number | null = Number.isFinite(s.value) ? s.value : null;
  if (attribute && value != null) {
    if (attribute.unit === "multiply") {
      if (/%/.test(s.shown)) value = 1 + value / 100;       // "+54.2%" -> 1.542
    } else value = Math.abs(value);                           // the form types magnitudes; sign comes from role
  }
  return { scanned: s, attribute, stat: attribute?.slug ?? null, value, is_negative: s.is_curse };
}

export function mapScan(scan: ScannedRiven, weapons: Weapon[], attrs: RivenAttribute[]) {
  const weapon = matchWeapon(scan.weapon_name, weapons);
  return {
    weapon_slug: weapon?.slug ?? null,
    weapon_name: scan.weapon_name,
    riven_name: scan.riven_name,
    polarity: scan.polarity,
    mastery_rank: scan.mastery_rank,
    rank: scan.rank,
    rerolls: scan.rerolls,
    notes: scan.notes,
    stats: scan.stats.map((s) => mapStat(s, attrs, weapon)),
  };
}
export type MappedScan = ReturnType<typeof mapScan>;
