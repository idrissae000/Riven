import { describe, expect, it } from "vitest";
import { gradeRiven } from "./grade";
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

  it("curses are graded the calculator's way: a milder penalty scores higher", () => {
    const [, , , zoom] = rifle([S("base_damage_/_melee_damage", 185.6216), S("critical_chance", 168.7432), S("critical_damage", 134.9966), S("zoom", -48.6, true)]);
    expect(zoom.tier).toBe("S");
    expect(zoom.explanation).toContain("milder penalty");
    const [, , , worst] = rifle([S("base_damage_/_melee_damage", 185.6216), S("critical_chance", 168.7432), S("critical_damage", 134.9966), S("zoom", -59.39, true)]);
    expect(worst.tier).toBe("F");
    expect(zoom.ends!.best).toBeCloseTo(-48.59514);
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

  it("ungraded when the calculator doesn't know the stat", () => {
    const g = rifle([S("blast", 50), S("critical_chance", 100)])[0];
    expect(g.tier).toBeNull();
    expect(g.explanation).toContain("no range for this stat");
  });

  it("ungraded when data isn't loaded or the layout isn't tabulated", () => {
    expect(gradeRiven({ rank: 8, stats: [S("critical_chance", 100)] }, SOMA, attrs, null)[0].explanation).toContain("isn’t loaded");
    const one = rifle([S("critical_chance", 100)])[0];
    expect(one.tier).toBeNull();
    expect(one.explanation).toContain("isn’t a layout the calculator covers");
  });
});
