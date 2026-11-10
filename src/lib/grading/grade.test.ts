import { describe, expect, it } from "vitest";
import { gradeRiven } from "./grade";
import { parseCurseRatings } from "./curse-ratings";
import { RIVENCALC_FIXTURE } from "@/lib/rivencalc/fixture";
import type { RivenAttribute, RivenStat } from "@/lib/types";

const attr = (slug: string, name: string, extra: Partial<RivenAttribute> = {}): RivenAttribute => ({
  slug, name, unit: "percent", exclusive_to: null, positive_only: false, inverted: false, prefix: null, suffix: null, ...extra,
});
const attrs = new Map([
  ["base_damage_/_melee_damage", attr("base_damage_/_melee_damage", "Damage")],
  ["critical_chance", attr("critical_chance", "Critical Chance")],
  ["critical_damage", attr("critical_damage", "Critical Damage")],
  ["zoom", attr("zoom", "Zoom")],
  ["recoil", attr("recoil", "Weapon Recoil", { inverted: true })],
  ["combo_duration", attr("combo_duration", "Combo Duration", { unit: "seconds" })],
  ["blast", attr("blast", "Blast")],
  ["ammo_maximum", attr("ammo_maximum", "Ammo Maximum")],
  ["chance_to_gain_combo_count", attr("chance_to_gain_combo_count", "Chance to Gain Combo Count")],
]);
const S = (stat: string, value: number, is_negative = false): RivenStat => ({ stat, value, is_negative });
const SOMA = { name: "Soma", riven_type: "rifle" };
const D = RIVENCALC_FIXTURE;

// Rifle, 3 positive + 1 negative at 1.2 disposition, max rank. Real numbers from browse.wf:
//   Damage 167.0595–204.1838 (center 185.6216) · Critical Chance centre 168.7432 · Critical Damage centre 134.9966
//   Zoom curse −48.5951 … −59.3941 (centre −53.9946)
const filler = [S("critical_chance", 168.7432), S("critical_damage", 134.9966), S("zoom", -53.9946, true)];
const gradeDamage = (value: number, rank = 8, weapon: { name: string; riven_type: string } = SOMA) =>
  gradeRiven({ rank, stats: [S("base_damage_/_melee_damage", value), ...filler] }, weapon, attrs, D)[0];
const rifle = (stats: RivenStat[]) => gradeRiven({ rank: 8, stats }, SOMA, attrs, D);

describe("gradeRiven with the browse.wf calculator data", () => {
  it("uses the calculator's min–max for the weapon type and layout", () => {
    const g = gradeDamage(185.6216);
    expect(g.range!.min).toBeCloseTo(167.0595, 3);
    expect(g.range!.max).toBeCloseTo(204.1838, 3);
    expect(g.tier).toBe("B");
    expect(g.pct).toBeCloseTo(0.5, 2);
  });

  it("the ends of the roll range are S and F", () => {
    expect(gradeDamage(204.1838).tier).toBe("S");
    expect(gradeDamage(167.0595).tier).toBe("F");
  });

  it("uses the calculator's band edges (A starts at +5.5% of center)", () => {
    expect(gradeDamage(185.6216 * 1.056).tier).toBe("A");
    expect(gradeDamage(185.6216 * 1.054).tier).toBe("A-");
  });

  it("explains the grade and where the roll sits", () => {
    const g = gradeDamage(185.6216);
    expect(g.explanation).toContain("Damage is around the middle of this weapon’s");
    expect(g.explanation).toContain("→ B");
    expect(g.context).toBe("Rifle · 3 positives, 1 negative");
  });

  it("exposes the 11-band table for the stat", () => {
    const g = gradeDamage(185.6216);
    expect(g.bands).toHaveLength(11);
    expect(g.bands[0].grade).toBe("S");
    expect(g.bands[0].toPct).toBe(100);
    expect(g.bands[10].fromPct).toBe(0);
  });

  it("flags values outside the possible range", () => {
    const g = gradeDamage(260);
    expect(g.outOfRange).toBe(true);
    expect(g.tier).toBe("S");
    expect(g.explanation).toContain("outside the possible range");
  });

  it("normalises to max rank before grading", () => {
    const g = gradeDamage(185.6216 / 9, 0);
    expect(g.valueAtMax).toBeCloseTo(185.6216);
    expect(g.tier).toBe("B");
    expect(g.explanation).toContain("scaled to max rank");
  });

  describe("curses have a fixed rating, not a roll grade", () => {
    const curse = (stat: string, value: number, weapon = SOMA, ratings?: Parameters<typeof gradeRiven>[4]) =>
      gradeRiven({ rank: 8, stats: [S("base_damage_/_melee_damage", 185.6216), S("critical_damage", 134.9966), S("zoom", 71.99), S(stat, value, true)] }, weapon, attrs, D, ratings)[3];

    it("a Zoom curse is S for any weapon at any roll (the roll only moves the gauge)", () => {
      const mild = curse("zoom", -48.6), harsh = curse("zoom", -59.39);
      expect(mild.tier).toBe("S");
      expect(harsh.tier).toBe("S");
      expect(mild.rollGrade).toBe("S"); // the milder roll sits at the top of the range…
      expect(harsh.rollGrade).toBe("F"); // …the harsher one at the bottom, but the grade doesn't follow
      expect(mild.pct).not.toBeCloseTo(harsh.pct!);
      expect(mild.gradeSource).toBe("curse-stat");
      expect(harsh.explanation).toContain("−Zoom is S for any weapon");
      expect(harsh.explanation).toContain("not based on the roll");
      expect(harsh.explanation).toContain("shown on the gauge");
    });

    it("a Critical Damage curse is F for any weapon, even the mildest roll", () => {
      const g = gradeRiven({ rank: 8, stats: [S("base_damage_/_melee_damage", 185.6216), S("critical_chance", 168.7432), S("zoom", 71.99), S("critical_damage", -97.2, true)] }, SOMA, attrs, D)[3];
      expect(g.tier).toBe("F");
      expect(g.rollGrade).toBe("S");
      expect(g.explanation).toContain("−Critical Damage is F for any weapon");
    });

    it("both the badge and the band table data are still there", () => {
      const g = curse("zoom", -53.99);
      expect(g.bands).toHaveLength(11);
      expect(g.range!.max).toBeCloseTo(-48.595, 2);
      expect(g.ends!.best).toBeCloseTo(-48.595, 2);
    });

    it("a weapon's own entry beats the stat's rating (Felarx: −Critical Chance is S)", () => {
      const crit = (weapon: { name: string; riven_type: string }) =>
        gradeRiven({ rank: 8, stats: [S("base_damage_/_melee_damage", 185.6), S("critical_damage", 135), S("zoom", 72), S("critical_chance", -135, true)] }, weapon, attrs, D)[3];
      const felarx = crit({ name: "Felarx", riven_type: "shotgun" });
      expect(felarx.tier).toBe("S");
      expect(felarx.gradeSource).toBe("curse-weapon");
      expect(felarx.explanation).toContain("−Critical Chance is S on the Felarx");
      expect(crit({ name: "felarx ", riven_type: "shotgun" }).tier).toBe("S"); // name match ignores case/spacing
      const hek = crit({ name: "Hek", riven_type: "shotgun" });
      expect(hek.tier).toBe("F");
      expect(hek.explanation).toContain("−Critical Chance is F for any weapon");
    });

    it("a curse with no rating is graded by its roll, and says so", () => {
      const grades = gradeRiven({ rank: 8, stats: [S("base_damage_/_melee_damage", 244.58), S("critical_chance", 100), S("chance_to_gain_combo_count", -56.05, true)] }, { name: "Galatine", riven_type: "melee" }, attrs, D);
      const g = grades[2];
      expect(g.gradeSource).toBe("curse-unrated");
      expect(g.tier).toBe("S"); // the mildest penalty, graded the calculator's way
      expect(g.tier).toBe(g.rollGrade);
      expect(g.explanation).toContain("no fixed rating for this curse");
    });

    it("positive stats are never touched by the ratings", () => {
      const g = gradeRiven({ rank: 8, stats: [S("zoom", 71.99), S("critical_chance", 168.7432), S("critical_damage", 134.9966), S("recoil", -91.2, true)] }, SOMA, attrs, D);
      expect(g[0].gradeSource).toBe("roll");
      expect(g[0].tier).toBe(g[0].rollGrade);
    });

    it("ratings come from the data file and can be swapped", () => {
      const custom = parseCurseRatings({ stats: { zoom: "D" }, weapons: { Soma: { zoom: "A" } } });
      expect(curse("zoom", -50, { name: "Boltor", riven_type: "rifle" }, custom).tier).toBe("D");
      expect(curse("zoom", -50, SOMA, custom).tier).toBe("A");
      expect(curse("zoom", -50, SOMA, parseCurseRatings({ stats: {} })).gradeSource).toBe("curse-unrated");
    });

    it("a fixed rating survives when the roll can't be placed in a range", () => {
      const g = gradeRiven({ rank: 8, stats: [S("critical_chance", 1), S("critical_damage", 1), S("zoom", 1), S("base_damage_/_melee_damage", 1), S("ammo_maximum", -20, true)] }, SOMA, attrs, D)[4];
      expect(g.tier).toBe("S"); // 4 positives + a curse isn't a layout the calculator covers
      expect(g.pct).toBeNull();
      expect(g.explanation).toContain("−Ammo Maximum is S for any weapon");
      expect(g.explanation).toContain("can’t be placed");
    });
  });

  it("weapon recoil: a bigger reduction is the better roll", () => {
    const base = [S("critical_chance", 168.7432), S("critical_damage", 134.9966), S("zoom", -53.9946, true)];
    expect(rifle([S("recoil", -101.25), ...base])[0].tier).toBe("B");
    expect(rifle([S("recoil", -111.3), ...base])[0].tier).toBe("S");
    expect(rifle([S("recoil", -91.2), ...base])[0].tier).toBe("F");
  });

  it("falls back to the weapon's riven type when the name isn't in the list", () => {
    const g = gradeDamage(185.6216, 8, { name: "Totally New Gun", riven_type: "rifle" });
    expect(g.tier).toBe("B");
    expect(g.note).toContain("isn't in the calculator's weapon list");
  });

  it("kitguns have their own category", () => {
    const g = gradeRiven({ rank: 8, stats: [S("base_damage_/_melee_damage", 197.64), S("critical_chance", 100), S("critical_damage", 100)] }, { name: "Catchmoon", riven_type: "kitgun" }, attrs, D)[0];
    expect(g.context).toBe("Kitgun · 3 positives");
    expect(g.range!.min).toBeCloseTo(177.876, 2);
    expect(g.tier).toBe("B");
    expect(g.note).toBeNull();
  });

  it("melee uses the melee damage stat", () => {
    const g = gradeRiven({ rank: 8, stats: [S("base_damage_/_melee_damage", 244.58), S("critical_chance", 100), S("zoom", -10, true)] }, { name: "Galatine", riven_type: "melee" }, attrs, D)[0];
    expect(g.context).toBe("Melee · 2 positives, 1 negative");
    expect(g.range!.min).toBeCloseTo(220.12, 1);
    expect(g.tier).toBe("B");
  });

  it("ungraded with an explanation when the calculator can't roll the stat there", () => {
    const g = rifle([S("combo_duration", 10), S("critical_chance", 100)])[0];
    expect(g.tier).toBeNull();
    expect(g.explanation).toContain("doesn’t list Combo Duration");
  });

  it("ungraded when neither source knows the stat", () => {
    const g = rifle([S("nope", 50), S("critical_chance", 100)])[0];
    expect(g.tier).toBeNull();
    expect(g.explanation).toContain("no range for this stat");
  });

  it("stats browse.wf lacks are graded from the Unified-Codex ranges, and say so", () => {
    // Codex: Blast on a rifle, layout 2/0: 90 × 1.2 × 0.99 = 106.92 center
    const blast = rifle([S("blast", 106.92), S("critical_chance", 178.19)])[0];
    expect(blast.tier).toBe("B");
    expect(blast.range!.min).toBeCloseTo(96.228, 2);
    expect(blast.range!.max).toBeCloseTo(117.612, 2);
    expect(blast.note).toContain("Unified-Codex");
    expect(rifle([S("blast", 117.6), S("critical_chance", 178.19)])[0].tier).toBe("S");
  });

  it("fills only the gaps: Zoom on shotguns comes from the Codex, on rifles from browse.wf", () => {
    const hek = { name: "Hek", riven_type: "shotgun" };
    const sg = gradeRiven({ rank: 8, stats: [S("zoom", 49.889), S("critical_chance", 100)] }, hek, attrs, D)[0];
    expect(sg.tier).toBe("B");
    expect(sg.note).toContain("Unified-Codex");
    const rf = rifle([S("zoom", 71.99), S("critical_chance", 100)])[0];
    expect(rf.note).toBeNull();
  });

  it("a fallback stat that can't roll as a penalty is ungraded, not mis-graded", () => {
    const g = rifle([S("critical_chance", 100), S("critical_damage", 100), S("blast", -20, true)]).at(-1)!;
    expect(g.tier).toBeNull();
  });

  it("ungraded when data isn't loaded or the layout isn't tabulated", () => {
    expect(gradeRiven({ rank: 8, stats: [S("critical_chance", 100)] }, SOMA, attrs, null)[0].explanation).toContain("isn’t loaded");
    const one = rifle([S("critical_chance", 100)])[0];
    expect(one.tier).toBeNull();
    expect(one.explanation).toContain("isn’t a layout the calculator covers");
  });
});
