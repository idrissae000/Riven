import { describe, expect, it } from "vitest";
import { gradeRiven } from "./grade";
import { CODEX_FIXTURE } from "@/lib/codex/fixture";
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
]);
const S = (stat: string, value: number, is_negative = false): RivenStat => ({ stat, value, is_negative });
const SOMA = { name: "Soma", riven_type: "rifle" };

// Rifle, 3 positive + 1 negative (layout 3/1, +0.9375 / −0.75): damage centre 198 × 0.9375 = 185.625 (the calculator's own example).
const filler = [S("critical_chance", 168.73875), S("critical_damage", 134.99663), S("zoom", -53.991, true)];
const gradeDamage = (value: number, rank = 8, weapon = SOMA) =>
  gradeRiven({ rank, stats: [S("base_damage_/_melee_damage", value), ...filler] }, weapon, attrs, CODEX_FIXTURE)[0];

describe("gradeRiven with the real Codex method", () => {
  it("reproduces the calculator's worked example range", () => {
    const g = gradeDamage(185.625);
    expect(g.range!.min).toBeCloseTo(167.0625, 3);
    expect(g.range!.max).toBeCloseTo(204.1875, 3);
    expect(g.tier).toBe("B");
    expect(g.pct).toBeCloseTo(0.5, 2);
  });

  it("top and bottom of the range are S and F", () => {
    expect(gradeDamage(204.1875).tier).toBe("S");
    expect(gradeDamage(167.0625).tier).toBe("F");
  });

  it("uses the calculator's band edges", () => {
    // +5.5% of centre is the A- / A edge; just inside A
    expect(gradeDamage(185.625 * 1.056).tier).toBe("A");
    expect(gradeDamage(185.625 * 1.054).tier).toBe("A-");
  });

  it("explains the grade in one sentence", () => {
    const g = gradeDamage(185.625);
    expect(g.explanation).toContain("Damage is around the middle of this weapon’s");
    expect(g.explanation).toContain("→ B");
    expect(g.context).toBe("Rifle · 3 positives, 1 negative".replace("positives", "positive"));
  });

  it("exposes the full band table for the stat", () => {
    const g = gradeDamage(185.625);
    expect(g.bands).toHaveLength(11);
    expect(g.bands.map((b) => b.grade)).toContain("A+");
  });

  it("flags values outside the possible range", () => {
    const g = gradeDamage(260);
    expect(g.outOfRange).toBe(true);
    expect(g.tier).toBe("S");
    expect(g.explanation).toContain("outside the possible range");
  });

  it("normalises to max rank before grading", () => {
    const g = gradeDamage(185.625 / 9, 0);
    expect(g.valueAtMax).toBeCloseTo(185.625);
    expect(g.tier).toBe("B");
    expect(g.explanation).toContain("scaled to max rank");
  });

  it("negative stats: grade follows roll size (magnitude)", () => {
    const grades = gradeRiven({ rank: 8, stats: [S("base_damage_/_melee_damage", 185.625), S("critical_chance", 168.73875), S("critical_damage", 134.99663), S("zoom", -59.39, true)] }, SOMA, attrs, CODEX_FIXTURE);
    expect(grades[3].tier).toBe("S");
    expect(grades[3].explanation).toContain("negative stat");
  });

  it("weapon recoil is inverted (a positive recoil stat is a negative number)", () => {
    const g = gradeRiven({ rank: 8, stats: [S("recoil", -101.25), S("critical_chance", 168.73875), S("critical_damage", 134.99663), S("zoom", -53.991, true)] }, SOMA, attrs, CODEX_FIXTURE)[0];
    expect(g.tier).toBe("B");
  });

  it("falls back to the weapon's riven type when the name isn't in the list", () => {
    expect(gradeDamage(185.625, 8, { name: "Totally New Gun", riven_type: "rifle" }).tier).toBe("B");
  });

  it("ungraded with an explanation when the stat can't roll on this weapon type", () => {
    const g = gradeRiven({ rank: 8, stats: [S("combo_duration", 10), S("critical_chance", 100)] }, SOMA, attrs, CODEX_FIXTURE)[0];
    expect(g.tier).toBeNull();
    expect(g.explanation).toContain("can’t roll on Rifle");
  });

  it("ungraded when data isn't loaded or the layout isn't covered", () => {
    expect(gradeRiven({ rank: 8, stats: [S("critical_chance", 100)] }, SOMA, attrs, null)[0].explanation).toContain("isn’t loaded");
    const one = gradeRiven({ rank: 8, stats: [S("critical_chance", 100)] }, SOMA, attrs, CODEX_FIXTURE)[0];
    expect(one.tier).toBeNull();
  });
});
