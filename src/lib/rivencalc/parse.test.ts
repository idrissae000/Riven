import { describe, expect, it } from "vitest";
import { buildRivenCalc, type RivenCalcSources } from "./parse";

// A miniature of browse.wf's page + RivenParser.js + export data, using the same formulas and real wording.
const CATS = [
  ["LotusArchgunRandomModRare", "Archgun"], ["LotusModularPistolRandomModRare", "Kitgun"], ["PlayerMeleeWeaponRandomModRare", "Melee"],
  ["LotusPistolRandomModRare", "Pistol"], ["LotusRifleRandomModRare", "Rifle"], ["LotusShotgunRandomModRare", "Shotgun"], ["LotusModularMeleeRandomModRare", "Zaw"],
] as const;
const TAGS = [
  { tag: "WeaponCritChanceMod", value: 0.016666, loc: "/Lotus/Language/Upgrades/WeaponCritChance" },
  { tag: "WeaponFactionDamageGrineer", value: 0.005, loc: "/Lotus/Language/Upgrades/WeaponFactionDamageGrineerDesc" },
  { tag: "WeaponMeleeComboPointsOnHitMod", value: -0.01165, loc: "/Lotus/Language/Upgrades/Combo", noBuff: true, reverse: true },
  { tag: "WeaponMeleeComboBonusOnHitMod", value: 0.00653, loc: "/Lotus/Language/Upgrades/ComboBonus" },
];

function sources(tweak: { js?: (s: string) => string; page?: (s: string) => string } = {}): RivenCalcSources {
  const tags = Object.fromEntries(CATS.map(([id]) => [id, TAGS.map((t) => ({ tag: t.tag, value: t.value, ...(t.noBuff ? {} : { prefix: "x", suffix: "y" }) }))]));
  const js = `const riven_tags = ${JSON.stringify(tags, null, 4)};
function rivenIntToFloat(i) { return i / 0x3FFFFFFF; }
const numBuffsAtten = [0, 1, .66000003, .5, .40000001, .34999999];
const numBuffsCurseAtten = [0, 1, .33000001, .5, 1.25, 1.5];
function parseRiven(rivenType, fingerprint, omegaAttenuation) {
    const curseAtten = Math.pow(1.25, fingerprint.curses.length);
    let attenuation = 1;
    attenuation *= 1.5; // SPECIFIC_FIT_ATTENUATION
    attenuation *= omegaAttenuation; // the weapon's riven disposition
    attenuation *= 10; // getBaseDrain(RIVEN_BASE_DRAIN)
    for (const buff of fingerprint.buffs) {
        let upgradeValue = riven_tags[rivenType].find(x => x.tag == buff.Tag).value;
        upgradeValue *= attenuation;
        upgradeValue *= curseAtten;
        upgradeValue *= lerp(0.9, 1.1, rivenIntToFloat(buff.Value));
        upgradeValue *= numBuffsAtten[Math.min(fingerprint.buffs.length, numBuffsAtten.length - 1)];
        upgradeValue *= fingerprint.lvl + 1;
    }
    for (const curse of fingerprint.curses) {
        let upgradeValue = riven_tags[rivenType].find(x => x.tag == curse.Tag).value * -1.0;
        upgradeValue *= attenuation;
        upgradeValue *= lerp(0.9, 1.1, rivenIntToFloat(curse.Value));
        upgradeValue *= numBuffsCurseAtten[Math.min(fingerprint.buffs.length, numBuffsCurseAtten.length - 1)];
        upgradeValue *= numBuffsAtten[Math.min(fingerprint.curses.length, numBuffsAtten.length - 1)];
        upgradeValue *= fingerprint.lvl + 1;
    }
}
function unparseBuff() {}
function floatToGrade(value) {
    value = lerp(-10, +10, value);
    if (value >= -11.5 && value <= +11.5) {
        if (value >= +9.5) return "S";
        if (value >= +7.5) return "A+";
        if (value >= +5.5) return "A";
        if (value >= +3.5) return "A-";
        if (value >= +1.5) return "B+";
        if (value >= -1.5) return "B";
        if (value >= -3.5) return "B-";
        if (value >= -5.5) return "C+";
        if (value >= -7.5) return "C";
        if (value >= -9.5) return "C-";
        return "F";
    }
    return "X";
}
const RivenParser = {};`;
  const page = `<p>Every stat has a random multiplier between 0.9x and 1.1x (or -10% to +10%).</p>
<select class="form-control" id="riven-type">${CATS.map(([id, n]) => `<option value="${id}">${n}</option>`).join("\n")}</select>
<select class="form-control" id="omega-attenuation"><option value="1">a</option><option value="1.2">b</option></select>
<input id="lvl" type="number" class="form-control" min="0" max="8" value="8" />
<script>
 if (upgrade.prefixTag != "") // Can be buff?
 { const f = RivenParser.unparseBuff(rivenType, omegaAttenuation, lvl, buffs, curses, upgrade.tag, 1); this.textContent = RivenParser.floatToGrade(f); }
 if (upgrade.tag != "WeaponMeleeComboBonusOnHitMod") // Can be curse?
 { if (upgrade.upgradeValues[0].reverseValueSymbol)
   {
     min.displayValue *= -1;
     max.displayValue *= -1;
   }
   const f = RivenParser.unparseCurse(rivenType, omegaAttenuation, lvl, buffs, curses, upgrade.tag, 1); this.textContent = RivenParser.floatToGrade(1 - f); }
</script>`;
  const upgrades: Record<string, unknown> = {};
  for (const [id] of CATS) {
    upgrades["/Lotus/Upgrades/Mods/Randomized/" + id] = {
      upgradeEntries: TAGS.map((t) => ({ tag: t.tag, prefixTag: t.noBuff ? "" : "/p", upgradeValues: [{ value: t.value, locTag: t.loc, ...(t.reverse ? { reverseValueSymbol: true } : {}) }] })),
      compatibleItems: id === "LotusRifleRandomModRare" ? ["/Lotus/Weapons/Soma"] : id === "LotusPistolRandomModRare" ? ["/Lotus/Weapons/Lex"] : [],
    };
  }
  const weapons = {
    "/Lotus/Weapons/Soma": { name: "/n/soma", totalDamage: 10 },
    "/Lotus/Weapons/SomaPrime": { name: "/n/somaprime", totalDamage: 10, parentName: "/Lotus/Weapons/Soma" },
    "/Lotus/Weapons/Lex": { name: "/n/lex", totalDamage: 10 },
    "/Lotus/Weapons/Chamber": { name: "/n/catchmoon", totalDamage: 0, omegaAttenuation: 1, primeOmegaAttenuation: 1 },
    "/Lotus/Weapons/Strike": { name: "/n/balla", totalDamage: 0, omegaAttenuation: 1.2 },
    "/Lotus/Weapons/Junk": { name: "/n/junk", totalDamage: 0, omegaAttenuation: 1 },
  };
  const dict = {
    "/n/soma": "Soma", "/n/somaprime": "Soma Prime", "/n/lex": "Lex", "/n/catchmoon": "Catchmoon", "/n/balla": "Balla",
    "/Lotus/Language/Upgrades/WeaponCritChance": "|val|% Critical Chance",
    "/Lotus/Language/Upgrades/WeaponFactionDamageGrineerDesc": "|val| Damage to Grineer",
    "/Lotus/Language/Upgrades/Combo": "|val|% Chance to Gain Combo Count",
    "/Lotus/Language/Upgrades/ComboBonus": "|val|% Additional Combo Count Chance",
  };
  return { pageHtml: (tweak.page ?? ((s) => s))(page), parserJs: (tweak.js ?? ((s) => s))(js), upgrades, weapons, dict };
}
const meta = { url: "u", parserUrl: "p", upgradesUrl: "e", weaponsUrl: "w", dictUrl: "d", sha256: { page: "a", parser: "b", upgrades: "c", weapons: "d", dict: "e" }, fetchedAt: "now" };
const map = { critical_chance: "WeaponCritChanceMod", damage_vs_grineer: ["WeaponFactionDamageGrineer"], chance_to_gain_combo_count: "WeaponMeleeComboPointsOnHitMod" };
const build = (tweak?: Parameters<typeof sources>[0]) => buildRivenCalc(sources(tweak), meta, map);

describe("buildRivenCalc", () => {
  it("reads the calculator's constants from its source", () => {
    const { data } = build();
    expect(data.roll).toEqual({ min: 0.9, max: 1.1 });
    expect(data.disposition).toBe(1.2);
    expect(data.rank).toBe(8);
    expect(data.outOfRangeDeviation).toBe(11.5);
    expect(data.curseGrading).toBe("inverted");
    expect(data.categories.map((c) => c.name)).toEqual(["Archgun", "Kitgun", "Melee", "Pistol", "Rifle", "Shotgun", "Zaw"]);
    expect(data.gradeBands.map((b) => [b.grade, b.lower, b.upper])).toEqual([
      ["F", -10, -9.5], ["C-", -9.5, -7.5], ["C", -7.5, -5.5], ["C+", -5.5, -3.5], ["B-", -3.5, -1.5], ["B", -1.5, 1.5],
      ["B+", 1.5, 3.5], ["A-", 3.5, 5.5], ["A", 5.5, 7.5], ["A+", 7.5, 9.5], ["S", 9.5, 10],
    ]);
  });

  it("tabulates every category × layout with the calculator's formula", () => {
    const { data } = build();
    const rifle = data.ranges.LotusRifleRandomModRare;
    expect(Object.keys(data.ranges)).toHaveLength(7);
    expect(Object.keys(rifle)).toEqual(["2/0", "2/1", "3/0", "3/1", "1/1"]);
    // 0.016666 × (1.5 × 1.2 × 10) × 0.66 × 9 = 1.7819 → 178.19%, ±10%
    expect(rifle["2/0"].buffs.WeaponCritChanceMod[0]).toBeCloseTo(160.3736, 3);
    expect(rifle["2/0"].buffs.WeaponCritChanceMod[1]).toBeCloseTo(196.0122, 3);
    // a curse boosts the riven's buffs ×1.25
    expect(rifle["2/1"].buffs.WeaponCritChanceMod[0]).toBeCloseTo(200.4670, 3);
    // curse: −0.016666 × 18 × 0.33 (2 buffs) × 1 (1 curse) × 9; the 0.9 roll is the milder end
    expect(rifle["2/1"].curses.WeaponCritChanceMod[0]).toBeCloseTo(-0.016666 * 18 * 0.33000001 * 9 * 0.9 * 100, 3);
    expect(rifle["2/1"].curses.WeaponCritChanceMod[1]).toBeLessThan(rifle["2/1"].curses.WeaponCritChanceMod[0]);
    // layouts without a curse have no curse table
    expect(rifle["2/0"].curses).toEqual({});
  });

  it("follows the page: buff table needs a prefix, curse table excludes the combo-bonus stat, reversed curse shows negative", () => {
    const { data } = build();
    const r = data.ranges.PlayerMeleeWeaponRandomModRare["2/1"];
    expect(Object.keys(r.buffs)).not.toContain("WeaponMeleeComboPointsOnHitMod");
    expect(Object.keys(r.curses)).toContain("WeaponMeleeComboPointsOnHitMod");
    expect(Object.keys(r.curses)).not.toContain("WeaponMeleeComboBonusOnHitMod");
    expect(r.curses.WeaponMeleeComboPointsOnHitMod[0]).toBeLessThan(0);
  });

  it("x stats are expressed as ×(1 + x)", () => {
    const { data } = build();
    expect(data.stats.find((s) => s.tag === "WeaponFactionDamageGrineer")!.unit).toBe("multiply");
    expect(data.ranges.LotusRifleRandomModRare["2/0"].buffs.WeaponFactionDamageGrineer[0]).toBeCloseTo(1.48114, 4);
    expect(data.stats.find((s) => s.tag === "WeaponCritChanceMod")).toMatchObject({ name: "Critical Chance", unit: "percent" });
  });

  it("works out which weapons belong to which category the way the page does", () => {
    const { data } = build();
    const cat = (n: string) => data.weapons.filter((w) => w.name === n).map((w) => w.category);
    expect(cat("Soma")).toEqual(["LotusRifleRandomModRare"]);
    expect(cat("Soma Prime")).toEqual(["LotusRifleRandomModRare"]); // inherits via parentName
    expect(cat("Lex")).toEqual(["LotusPistolRandomModRare"]);
    expect(cat("Catchmoon (Primary)")).toEqual(["LotusModularPistolRandomModRare"]);
    expect(cat("Catchmoon")).toEqual(["LotusModularPistolRandomModRare"]);
    expect(cat("Balla")).toEqual(["LotusModularMeleeRandomModRare"]);
    expect(cat("junk")).toEqual([]);
  });

  it("maps Warframe Market slugs to stat tags", () => {
    expect(build().data.statSlugs).toEqual({ critical_chance: ["WeaponCritChanceMod"], damage_vs_grineer: ["WeaponFactionDamageGrineer"], chance_to_gain_combo_count: ["WeaponMeleeComboPointsOnHitMod"] });
    expect(() => buildRivenCalc(sources(), meta, { nope: "NotAStat" })).toThrow(/not a stat on browse.wf/);
  });

  it("warns when the two sources disagree on a base value", () => {
    const s = sources();
    (s.upgrades["/Lotus/Upgrades/Mods/Randomized/LotusRifleRandomModRare"] as { upgradeEntries: { upgradeValues: { value: number }[] }[] }).upgradeEntries[0].upgradeValues[0].value = 0.02;
    expect(buildRivenCalc(s, meta, map).warnings[0]).toContain("LotusRifleRandomModRare WeaponCritChanceMod");
  });

  describe("refuses to guess when the source changes", () => {
    it("roll range", () => expect(() => build({ js: (s) => s.replaceAll("lerp(0.9, 1.1,", "lerp(0.8, 1.2,") })).toThrow(/roll range|could not confirm/));
    it("attenuation", () => expect(() => build({ js: (s) => s.replace("attenuation *= 10;", "attenuation *= 12;") })).toThrow(/attenuation/));
    it("curse boost", () => expect(() => build({ js: (s) => s.replace("Math.pow(1.25,", "Math.pow(1.3,") })).toThrow(/1\.25/));
    it("disposition 1.2 no longer offered", () => expect(() => build({ page: (s) => s.replace('<option value="1.2">', '<option value="1.3">') })).toThrow(/disposition 1.2/));
    it("±10% text gone", () => expect(() => build({ page: (s) => s.replace("between 0.9x and 1.1x", "somewhere") })).toThrow(/±10%/));
  });

  it("reads how the page grades curses", () => {
    expect(build({ page: (s) => s.replace("floatToGrade(1 - f)", "floatToGrade(f)") }).data.curseGrading).toBe("same");
  });
});
