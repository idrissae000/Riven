/**
 * Varzia lists her stock under the game's internal names ("Infestation Prime", "Prime Strun Weapon", "Prime Nikana"). The tradable
 * thing is the Prime SET on Warframe Market ("Nidus Prime Set", "Strun Prime Set", "Nikana Prime Set"). Null = not a Prime set
 * (cosmetics, packs, relics, ship decorations) or a name we can't map with confidence.
 */
const RENAMES: Record<string, string> = { "infestation prime": "Nidus Prime" }; // internal name -> public name

export function setNameFor(item: string): string | null {
  const name = item.trim();
  const lower = name.toLowerCase();
  if (RENAMES[lower]) return `${RENAMES[lower]} Set`;
  // "Saryn Prime" (a Warframe)
  let m = /^(.+) Prime$/i.exec(name);
  if (m && !/\b(pack|scene|syandana|sigil|scarf|bobble|maggot|skin|vault)\b/i.test(m[1])) return `${m[1]} Prime Set`;
  // "Prime Strun Weapon", "Prime Nikana" (a weapon)
  m = /^Prime (.+?)(?: Weapon)?$/i.exec(name);
  if (m && !/\b(scarf|sigil|item)\b/i.test(m[1])) return `${m[1]} Prime Set`;
  return null;
}
