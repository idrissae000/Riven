/**
 * Loid's Arcane Collections ("Vosfor packs"), read from the Warframe Wiki's "Loid (Original)" page — the table in its
 * `loidogoffer` section. Each collection has a rarity split and a pool of arcanes; within a rarity every arcane is
 * equally likely. The wiki prints each pool's size next to its chance ("45% (… × 2)"), which we use to cross-check
 * the parse. Anything that doesn't line up throws instead of guessing.
 */
export const RARITIES = ["Common", "Uncommon", "Rare", "Legendary"] as const;
export type CollectionRarity = (typeof RARITIES)[number];

export interface CollectionTier {
  rarity: CollectionRarity;
  /** Chance (percent) that one of the collection's picks is of this rarity. 0 = the collection has none. */
  chance: number;
  /** Arcane names (as the wiki spells them), equally likely within the tier. */
  arcanes: string[];
}
export interface ParsedCollection { id: string; name: string; tiers: CollectionTier[] }
export interface ParsedCollections { vosfor: number; credits: number; picks: number; collections: ParsedCollection[] }

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

export function parseCollections(wikitext: string): ParsedCollections {
  const begin = wikitext.search(/<section begin=loidogoffer\s*\/>/);
  if (begin < 0) throw new Error("Loid page changed: the `loidogoffer` section is gone");
  const end = wikitext.search(/<section end=loidogoffer\s*\/>/);
  const section = wikitext.slice(begin, end < 0 ? undefined : end);

  const cost = /each cost (\d+) \{\{Resource\|Vosfor\}\} and \{\{cc\|([\d,]+)\}\}/.exec(section);
  const picksWord = /receive (\w+) random arcane/i.exec(section)?.[1]?.toLowerCase();
  const picks = picksWord ? NUMBER_WORDS[picksWord] ?? Number(picksWord) : NaN;
  if (!cost || !Number.isFinite(picks)) throw new Error("Loid page changed: couldn't read the collection price / number of arcanes");

  // the column order must be Common, Uncommon, Rare, Legendary
  const head = section.slice(0, section.search(/\n!rowspan=2/));
  const headOrder = [...head.matchAll(/Icon(Common|Uncommon|Rare|Legendary)\.png/g)].map((m) => m[1]);
  if (headOrder.join() !== RARITIES.join()) throw new Error(`Loid page changed: rarity columns are ${headOrder.join(", ") || "missing"}`);

  const collections: ParsedCollection[] = [];
  for (const chunk of section.split(/\n!rowspan=2\|/).slice(1)) {
    const headerLine = chunk.split("\n")[0];
    const name = /<br\s*\/?>\s*([^<\n]+?)\s*$/.exec(headerLine)?.[1];
    if (!name) throw new Error(`Loid page changed: can't read a collection name from ${JSON.stringify(headerLine)}`);
    const body = chunk.slice(chunk.indexOf("\n") + 1);
    const [poolsRow, oddsRow] = body.split(/^\|-\s*$/m).map((r) => r.split("\n").filter((l) => l.startsWith("|")).map((l) => l.slice(1)));
    if (!poolsRow || !oddsRow || poolsRow.length !== 4 || oddsRow.length !== 4) throw new Error(`Loid page changed: ${name} doesn't have 4 pool cells and 4 chance cells`);

    const tiers = RARITIES.map((rarity, i): CollectionTier => {
      const arcanes = [...poolsRow[i].matchAll(/\{\{Arcane\|([^}|]+)\}\}/g)].map((m) => m[1].trim());
      const odds = oddsRow[i];
      const chance = /^\s*'''-'''/.test(odds) ? 0 : Number(/'''([\d.]+)%'''/.exec(odds)?.[1]);
      if (!Number.isFinite(chance)) throw new Error(`Loid page changed: can't read ${name}'s ${rarity} chance from ${JSON.stringify(odds)}`);
      const counted = Number(/×\s*(\d+)\s*\)/.exec(odds)?.[1] ?? 0);
      if (chance > 0 ? counted !== arcanes.length : arcanes.length !== 0) throw new Error(`${name} ${rarity}: the wiki says ${counted} arcanes but the table lists ${arcanes.length}`);
      return { rarity, chance, arcanes };
    });
    const total = tiers.reduce((s, t) => s + t.chance, 0);
    if (Math.abs(total - 100) > 0.01) throw new Error(`${name}: rarity chances add up to ${total}%, not 100%`);
    collections.push({ id: name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), name, tiers });
  }
  if (collections.length < 2) throw new Error("Loid page changed: found fewer than 2 collections");
  return { vosfor: Number(cost[1]), credits: Number(cost[2].replace(/,/g, "")), picks, collections };
}
