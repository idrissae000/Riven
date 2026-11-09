import { describe, expect, it } from "vitest";
import { buildArcane, slugify, type UpgradeTypeMap } from "./build";

const map: UpgradeTypeMap = {
  AVATAR_ABILITY_STRENGTH: { label: "Ability Strength", category: "abilities" },
  WEAPON_FIRE_RATE: { label: "Fire rate", category: "weapons" },
  GAMEPLAY_FREE_REVIVE_COUNT: { label: "Free revive", category: "utility", hidden: true },
};
const page = `{{ArcaneBox}}
==Acquisition==
*Can be bought from [[Roathe]] for 5 {{Resource|Maphica}}.
==Notes==
*Cannot be equipped on [[Exalted Weapon]]s like {{Weapon|Dex Pixia}}.`;

describe("buildArcane", () => {
  it("derives structured compatibility from wiki fields", () => {
    const unmapped = new Set<string>();
    const a = buildArcane(
      { Name: "Arcane Acceleration", Type: "Warframe", Rarity: "Uncommon", MaxRank: 5, Description: "On Critical Hit:\r\n30% chance for +90% Fire Rate",
        UpgradeTypes: ["WEAPON_FIRE_RATE", "GAMEPLAY_FREE_REVIVE_COUNT", "SOMETHING_NEW"], IncompatibilityTags: ["OPERATOR_SUIT"] },
      page, 123, map, undefined, unmapped,
    );
    expect(a.slug).toBe("arcane_acceleration");
    expect(a.compatibility).toMatchObject({ equips_on: "Warframe", scales_with: ["Fire rate", "Something new"], categories: ["weapons", "other"], ability_scaling: false, excludes: ["Operator suit (Void Mode)"] });
    expect(a.compatibility.notes[0]).toContain("Cannot be equipped on Exalted Weapons");
    expect(a.effect_stats.map((e) => e.key)).toContain("GAMEPLAY_FREE_REVIVE_COUNT"); // kept in data, hidden from labels
    expect(a.description).toBe("On Critical Hit:\n30% chance for +90% Fire Rate");
    expect(a.drop_sources[0]).toMatchObject({ kind: "vendor", links: ["Roathe"] });
    expect(a.wiki_url).toBe("https://wiki.warframe.com/w/Arcane_Acceleration");
    expect([...unmapped]).toEqual(["SOMETHING_NEW"]);
  });

  it("flags ability-scaling arcanes", () => {
    const a = buildArcane({ Name: "Arcane X", Type: "Warframe", UpgradeTypes: ["AVATAR_ABILITY_STRENGTH"] }, page, 1, map, undefined, new Set());
    expect(a.compatibility.ability_scaling).toBe(true);
    expect(a.compatibility.categories).toEqual(["abilities"]);
  });

  it("applies overrides over wiki data and records which fields", () => {
    const a = buildArcane(
      { Name: "Arcane X", Type: "Warframe", UpgradeTypes: ["AVATAR_ABILITY_STRENGTH"] }, page, 1, map,
      { compatibility: { abilities: [{ name: "Roar", affected: true }], playstyles: ["strength"] }, drop_sources: [{ text: "Netracells", kind: "reward", links: ["Netracells"], details: [] }] },
      new Set(),
    );
    expect(a.compatibility.abilities).toEqual([{ name: "Roar", affected: true }]);
    expect(a.compatibility.scales_with).toEqual(["Ability Strength"]); // wiki-derived part retained
    expect(a.drop_sources).toHaveLength(1);
    expect(a.overridden_fields).toEqual(["compatibility", "drop_sources"]);
  });

  it("flags missing data for review instead of inventing it", () => {
    const a = buildArcane({ Name: "Bare", Type: "Melee" }, null, null, map, undefined, new Set());
    expect(a.drop_sources).toEqual([]);
    expect(a.needs_review.length).toBe(2);
  });

  it("parses per-ability trigger tables from the wiki page into ability_lists", () => {
    const wt = `==Notes==\n===Valid Objects===\n{| class="wikitable"\n|-\n! Warframe\n! Ability\n! Notes\n|-\n| rowspan=1 | {{WF|Atlas}}\n| {{A|Tectonics}}\n|\n|}`;
    const a = buildArcane({ Name: "Arcane Sculptor", Type: "Warframe" }, wt, 1, map, undefined, new Set(), (wf, ab) => wf === "Atlas" && ab === "Tectonics");
    expect(a.compatibility.ability_lists).toHaveLength(1);
    expect(a.compatibility.ability_lists[0].abilities[0]).toEqual({ warframe: "Atlas", name: "Tectonics", helminth: true, note: null });
  });

  it("slugifies", () => expect(slugify("Akimbo Slip Shot")).toBe("akimbo_slip_shot"));
});
