import { describe, expect, it } from "vitest";
import { abilityLabel, buildAbilities, modifiersFor } from "./build";

const abilities = {
  Roar: { Name: "Roar", Powersuit: "Rhino", Key: 3, Cost: 75, Subsumable: true, InternalName: "/Lotus/Powersuits/Rhino/Abilities/RhinoRoarAbility" },
  Scan: { Name: "Scan", Powersuit: "Nyx", Key: 1, Cost: 25, InternalName: "/Lotus/Powersuits/Nyx/Abilities/NyxScanAbility" },
  Orphan: { Name: "Orphan", InternalName: "/x" },
};
const stats = {
  "/Lotus/Powersuits/PowersuitAbilities/RhinoRoarAbility": [
    { Modifier: "AVATAR_ABILITY_EFFICIENCY" }, { Modifier: "AVATAR_ABILITY_STRENGTH" }, { Modifier: "AVATAR_ABILITY_DURATION" }, { Modifier: "ENERGY_DRAIN" }, { Modifier: "AVATAR_ABILITY_STRENGTH" },
  ],
  "/Lotus/Powersuits/PowersuitAbilities/NyxScanAbility": [{ Modifier: "AVATAR_ABILITY_RANGE" }],
};

describe("buildAbilities", () => {
  const rows = buildAbilities(abilities, stats);
  it("attributes abilities to their Warframe, skipping ones with no owner", () => {
    expect(rows.map((r) => r.name)).toEqual(["Roar", "Scan"]);
    expect(rows[0]).toMatchObject({ warframe: "Rhino", key: 3, helminth: true, slug: "rhino_roar" });
    expect(rows[1].helminth).toBe(false);
  });
  it("collects only ability-scaling modifiers, de-duplicated", () => {
    expect(rows[0].modifiers).toEqual(["AVATAR_ABILITY_DURATION", "AVATAR_ABILITY_EFFICIENCY", "AVATAR_ABILITY_STRENGTH"]);
    expect(rows[1].modifiers).toEqual(["AVATAR_ABILITY_RANGE"]);
  });
  it("labels with the Warframe in parentheses and a star for Helminth abilities", () => {
    expect(abilityLabel(rows[0])).toBe("Roar (Rhino) ★");
    expect(abilityLabel(rows[1])).toBe("Scan (Nyx)");
  });
});

describe("modifiersFor", () => {
  it("keeps only the stats that boost abilities", () => {
    expect(modifiersFor(["AVATAR_ABILITY_STRENGTH", "WEAPON_DAMAGE_AMOUNT", "GAMEPLAY_FREE_REVIVE_COUNT", "AVATAR_ABILITY_DURATION"])).toEqual(["AVATAR_ABILITY_STRENGTH", "AVATAR_ABILITY_DURATION"]);
  });
});

describe("unique slugs", () => {
  it("disambiguates the same ability name on different slots", () => {
    const rows = buildAbilities({ A: { Name: "Restorative", Powersuit: "Drifter", Key: 1 }, B: { Name: "Restorative", Powersuit: "Drifter", Key: 3 } }, {});
    expect(new Set(rows.map((r) => r.slug)).size).toBe(2);
  });
});
