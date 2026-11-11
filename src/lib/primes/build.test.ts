import { describe, expect, it } from "vitest";
import { buildPrimes, type ExportRewards, type WfmItem } from "./build";

const item = (slug: string, gameRef: string, tags: string[], extra: Partial<WfmItem> = {}): WfmItem => ({ slug, gameRef, tags, i18n: { en: { name: slug.replace(/_/g, " ") } }, ...extra });
const items: WfmItem[] = [
  item("frost_prime_set", "/Lotus/Powersuits/Frost/FrostPrime", ["set", "prime", "warframe"], { ducats: 175 }),
  item("frost_prime_chassis_blueprint", "/Lotus/Types/Recipes/WarframeRecipes/FrostPrimeChassisBlueprint", ["component", "prime", "warframe", "blueprint"], { ducats: 100 }),
  item("lex_prime_set", "/Lotus/Weapons/Lex/LexPrime", ["set", "prime", "weapon", "secondary"]),
  item("lex_prime_barrel", "/Lotus/Types/Recipes/Weapons/WeaponParts/LexPrimeBarrel", ["component", "prime", "weapon", "secondary"], { ducats: 45 }),
  item("lex_prime_blueprint", "/Lotus/Types/Recipes/Weapons/LexPrimeBlueprint", ["prime", "weapon", "secondary", "blueprint"], { ducats: 15 }),
  item("baro_only_prime_blueprint", "/Lotus/Types/Recipes/BaroPrime", ["prime", "warframe", "blueprint"]),
  item("lith_a1_relic", "/Lotus/Types/Game/Projections/A1", ["relic", "lith"], { vaulted: true }),
  item("meso_b2_relic", "/Lotus/Types/Game/Projections/B2", ["relic", "meso"], { vaulted: false }),
  item("arcane_energize", "/Lotus/Arcane/E", ["arcane_enhancement"]),
];
const R = (type: string, rarity: string) => ({ type, rarity, itemCount: 1 });
const drops = (rare: string) => [[
  R("/Lotus/StoreItems/Types/Recipes/Components/FormaBlueprint", "COMMON"),
  R("/Lotus/StoreItems/Types/Recipes/Weapons/WeaponParts/LexPrimeBarrel", "COMMON"),
  R("/Lotus/StoreItems/Types/Recipes/Weapons/LexPrimeBlueprint", "COMMON"),
  R("/Lotus/StoreItems/Types/Recipes/WarframeRecipes/FrostPrimeChassisBlueprint", "UNCOMMON"),
  R("/Lotus/StoreItems/Types/Recipes/WarframeRecipes/FrostPrimeChassisBlueprint", "UNCOMMON"),
  R(rare, "RARE"),
]];
const rewards: ExportRewards = { a1: drops("/Lotus/StoreItems/Types/Recipes/Weapons/WeaponParts/LexPrimeBarrel"), b2: drops("/Lotus/StoreItems/Types/Recipes/Weapons/WeaponParts/LexPrimeBarrel") };
const relics = {
  "/p/A1Intact": { era: "Lith", category: "A1", rewardManifest: "a1" }, "/p/A1Radiant": { era: "Lith", category: "A1", rewardManifest: "a1" },
  "/p/B2Intact": { era: "Meso", category: "B2", rewardManifest: "b2" }, "/p/Req": { era: "Requiem", category: "I", rewardManifest: "a1" },
};

describe("buildPrimes", () => {
  const { parts, relics: rel } = buildPrimes({ items, relics, rewards });

  it("one relic per era+category (refinement variants collapsed) and no Requiem", () => expect(rel.map((r) => r.id)).toEqual(["lith_a1", "meso_b2"]));
  it("takes vaulted status from the market's relic item", () => expect(rel.map((r) => [r.name, r.vaulted])).toEqual([["Lith A1", true], ["Meso B2", false]]));
  it("maps rewards to market slugs: 3 common, 2 uncommon, 1 rare", () => {
    expect(rel[0].common).toEqual([null, "lex_prime_barrel", "lex_prime_blueprint"]); // the first is Forma: untradable → null
    expect(rel[0].uncommon).toEqual(["frost_prime_chassis_blueprint", "frost_prime_chassis_blueprint"]);
    expect(rel[0].rare).toBe("lex_prime_barrel");
  });
  it("parts include blueprints and sets, not relics or arcanes", () => expect(parts.map((p) => p.slug).sort()).toEqual(["baro_only_prime_blueprint", "frost_prime_chassis_blueprint", "frost_prime_set", "lex_prime_barrel", "lex_prime_blueprint", "lex_prime_set"]));
  it("classifies type, kind, ducats and set", () => {
    const by = (s: string) => parts.find((p) => p.slug === s)!;
    expect(by("frost_prime_set")).toMatchObject({ kind: "set", type: "warframe", ducats: 175, setSlug: null });
    expect(by("lex_prime_barrel")).toMatchObject({ kind: "part", type: "secondary", ducats: 45, setSlug: "lex_prime_set" });
    expect(by("lex_prime_blueprint").kind).toBe("part");
    expect(by("baro_only_prime_blueprint").setSlug).toBeNull();
  });
  it("a part is vaulted only if every relic that drops it is", () => {
    const by = (s: string) => parts.find((p) => p.slug === s)!;
    expect(by("lex_prime_barrel").vaulted).toBe(false); // Lith A1 (vaulted) + Meso B2 (not)
    expect(by("lex_prime_barrel").relics).toEqual(["lith_a1", "meso_b2"]);
    expect(by("baro_only_prime_blueprint")).toMatchObject({ vaulted: null, relics: [] });
    expect(by("frost_prime_set").vaulted).toBeNull();
  });
  it("refuses a relic that doesn't drop 3/2/1", () => {
    const bad = { a1: [[R("/Lotus/StoreItems/Types/Recipes/Weapons/LexPrimeBlueprint", "RARE"), ...drops("x")[0].slice(1)]] };
    expect(() => buildPrimes({ items, relics, rewards: bad as ExportRewards })).toThrow(/expected 3 common/);
  });
});
