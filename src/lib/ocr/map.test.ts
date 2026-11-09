import { describe, expect, it } from "vitest";
import { mapScan, mapStat, matchAttribute, matchWeapon } from "./map";
import type { RivenAttribute, Weapon } from "@/lib/types";

const A = (slug: string, name: string, extra: Partial<RivenAttribute> = {}): RivenAttribute =>
  ({ slug, name, unit: "percent", exclusive_to: null, positive_only: false, inverted: false, prefix: null, suffix: null, ...extra });
const attrs = [
  A("critical_damage", "Critical Damage"), A("critical_chance", "Critical Chance"),
  A("base_damage_/_melee_damage", "Damage / Melee Damage"), A("toxin_damage", "Toxin"),
  A("damage_vs_infested", "Damage to Infested", { unit: "multiply" }),
  A("recoil", "Weapon Recoil", { inverted: true, exclusive_to: ["rifle", "pistol"] }),
  A("fire_rate_/_attack_speed", "Fire Rate / Attack Speed"), A("zoom", "Zoom"),
  A("projectile_speed", "Projectile Speed"), A("critical_chance_on_slide_attack", "Critical Chance for Slide Attack"),
  A("chance_to_gain_extra_combo_count", "Additional Combo Count Chance"), A("magazine_capacity", "Magazine Capacity"), A("status_chance", "Status Chance"),
];
const weapons = [{ slug: "soma", name: "Soma", riven_type: "rifle" }, { slug: "galatine", name: "Galatine", riven_type: "melee" }] as Weapon[];

describe("matchAttribute", () => {
  it.each([
    ["Critical Damage", "critical_damage"], ["critical chance", "critical_chance"], ["Damage", "base_damage_/_melee_damage"],
    ["Melee Damage", "base_damage_/_melee_damage"], ["Fire Rate", "fire_rate_/_attack_speed"], ["Recoil", "recoil"],
    ["Damage to Infested", "damage_vs_infested"], ["Toxin Damage", "toxin_damage"],
    ["Projectile Flight Speed", "projectile_speed"], ["Slide Attack Critical Chance", "critical_chance_on_slide_attack"],
    ["Chance to Gain Extra Combo Count", "chance_to_gain_extra_combo_count"], ["Magazine Capacity", "magazine_capacity"], ["Status Chance", "status_chance"],
  ])("%s -> %s", (n, slug) => expect(matchAttribute(n, attrs)?.slug).toBe(slug));
  it("returns null for unknown stats instead of guessing", () => expect(matchAttribute("Bananas", attrs)).toBeNull());
});

describe("matchWeapon", () => {
  it("matches case-insensitively and rejects unknown", () => {
    expect(matchWeapon("SOMA", weapons)?.slug).toBe("soma");
    expect(matchWeapon("Soma Prime", weapons)).toBeNull();
  });
});

describe("mapStat", () => {
  it("types magnitudes (sign comes from role) and flags the curse", () => {
    const m = mapStat({ name: "Zoom", value: -30.5, shown: "-30.5%", is_curse: true }, attrs, null);
    expect(m).toMatchObject({ stat: "zoom", value: 30.5, is_negative: true });
  });
  it("converts a percent shown for a multiplier stat to xN", () => {
    expect(mapStat({ name: "Damage to Infested", value: 54.2, shown: "+54.2%", is_curse: false }, attrs, null).value).toBeCloseTo(1.542);
    expect(mapStat({ name: "Damage to Infested", value: 1.54, shown: "x1.54", is_curse: false }, attrs, null).value).toBe(1.54);
  });
  it("won't map a stat the weapon type can't roll", () => {
    expect(mapStat({ name: "Recoil", value: -40, shown: "-40%", is_curse: false }, attrs, weapons[1]).stat).toBeNull();
    expect(mapStat({ name: "Recoil", value: -40, shown: "-40%", is_curse: false }, attrs, weapons[0]).stat).toBe("recoil");
  });
});

describe("mapScan", () => {
  it("maps the weapon and every stat", () => {
    const r = mapScan({ weapon_name: "Soma", riven_name: "Crita-cron", polarity: "madurai", mastery_rank: 11, rank: 8, rerolls: 3, notes: null,
      stats: [{ name: "Critical Chance", value: 150, shown: "+150%", is_curse: false }, { name: "Mystery", value: 1, shown: "+1%", is_curse: false }] }, weapons, attrs);
    expect(r.weapon_slug).toBe("soma");
    expect(r.stats.map((s) => s.stat)).toEqual(["critical_chance", null]);
  });
});
