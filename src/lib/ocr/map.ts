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
  "projectile flight speed": "projectile speed",
  "slide attack critical chance": "critical chance for slide attack",
  "critical chance for slide attack": "critical chance for slide attack",
  "chance to gain extra combo count": "additional combo count chance",
  "extra combo count chance": "additional combo count chance",
  "combo count chance": "chance to gain combo count",
  "heavy attack efficiency": "heavy attack efficiency",
  "weapon recoil": "weapon recoil",
  "reload speed": "reload speed",
  "damage vs grineer": "damage vs grineer", "damage vs corpus": "damage vs corpus", "damage vs infested": "damage vs infested",
  "damage to orokin": "damage to orokin", "damage to techrot": "damage to techrot", "damage to scaldra": "damage to scaldra",
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

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Words that sometimes get read along with the weapon name but aren't part of it. */
const NOISE = new Set(["riven", "mod", "rivenmod"]);

/**
 * Finds the weapon in the card's TITLE, which prints the weapon and the riven's generated name together
 * ("Soma Crita-cron"). The model sometimes files the whole title under riven_name (or leaves weapon_name
 * empty), so we look at the leading words of both fields: longest exact weapon name first, then a close
 * (typo-tolerant) match. Whatever follows the weapon becomes the riven name.
 */
export function resolveWeapon(
  weaponName: string | null,
  rivenName: string | null,
  weapons: Weapon[],
): { weapon: Weapon | null; rivenName: string | null } {
  const byNorm = new Map(weapons.map((w) => [norm(w.name), w]));
  const words = (t: string | null) => (t ?? "").split(/\s+/).filter((x) => x && !NOISE.has(norm(x)));

  const tryTokens = (tokens: string[]): { weapon: Weapon; used: number } | null => {
    for (let k = Math.min(4, tokens.length); k >= 1; k--) { // longest first, so "Kuva Bramma" beats a shorter name
      const w = byNorm.get(norm(tokens.slice(0, k).join(" ")));
      if (w) return { weapon: w, used: k };
    }
    // typo tolerance: a unique close match only
    for (let k = Math.min(4, tokens.length); k >= 1; k--) {
      const cand = norm(tokens.slice(0, k).join(" "));
      if (cand.length < 3) continue;
      const maxDist = cand.length <= 5 ? 1 : 2;
      const close = [...byNorm].filter(([n]) => Math.abs(n.length - cand.length) <= maxDist && editDistance(n, cand) <= maxDist);
      if (close.length === 1) return { weapon: close[0][1], used: k };
    }
    return null;
  };

  const fromWeapon = tryTokens(words(weaponName));
  if (fromWeapon) {
    // The weapon field may also contain the riven name ("Soma Crita-cron"): treat the rest as the riven name.
    const rest = words(weaponName).slice(fromWeapon.used).join(" ");
    return { weapon: fromWeapon.weapon, rivenName: rivenName?.trim() ? stripWeapon(rivenName, fromWeapon.weapon) : rest || null };
  }
  const rt = words(rivenName);
  const fromRiven = tryTokens(rt);
  if (fromRiven) return { weapon: fromRiven.weapon, rivenName: rt.slice(fromRiven.used).join(" ") || null };
  return { weapon: null, rivenName: rivenName?.trim() || null };
}

/** If the riven name also starts with the weapon's name ("Soma Crita-cron"), drop that part. */
function stripWeapon(rivenName: string, weapon: Weapon): string | null {
  const toks = rivenName.split(/\s+/).filter(Boolean);
  const n = weapon.name.split(/\s+/).length;
  const lead = norm(toks.slice(0, n).join(" "));
  const out = lead === norm(weapon.name) ? toks.slice(n).join(" ") : rivenName.trim();
  return out || null;
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
  const { weapon, rivenName } = resolveWeapon(scan.weapon_name, scan.riven_name, weapons);
  return {
    weapon_slug: weapon?.slug ?? null,
    weapon_name: weapon?.name ?? scan.weapon_name,
    riven_name: rivenName,
    polarity: scan.polarity,
    mastery_rank: scan.mastery_rank,
    rank: scan.rank,
    rerolls: scan.rerolls,
    notes: scan.notes,
    stats: scan.stats.map((s) => mapStat(s, attrs, weapon)),
  };
}
export type MappedScan = ReturnType<typeof mapScan>;
