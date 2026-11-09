import { describe, expect, it } from "vitest";
import { gradeRiven, gradeStat, lookupRange, tierForPct, type GradeRange } from "./grade";
import type { RivenAttribute } from "@/lib/types";

const attr = (slug: string, name: string, extra: Partial<RivenAttribute> = {}): RivenAttribute => ({
  slug, name, unit: "percent", exclusive_to: null, positive_only: false, inverted: false, prefix: null, suffix: null, ...extra,
});
const attrs = new Map([
  ["critical_chance", attr("critical_chance", "Critical Chance")],
  ["toxin_damage", attr("toxin_damage", "Toxin")],
  ["zoom", attr("zoom", "Zoom")],
  ["recoil", attr("recoil", "Weapon Recoil", { inverted: true })],
  ["damage_vs_infested", attr("damage_vs_infested", "Damage to Infested", { unit: "multiply" })],
]);
const R = (stat: string, min: number, max: number, extra: Partial<GradeRange> = {}): GradeRange =>
  ({ weapon_slug: "soma", stat_slug: stat, is_negative: false, min_roll: min, max_roll: max, is_placeholder: false, ...extra });

const grade = (stat: string, value: number, ranges: GradeRange[], opts: { neg?: boolean; rank?: number } = {}) =>
  gradeStat({ stat, value, is_negative: !!opts.neg }, opts.rank ?? 8, "soma", "Soma", attrs.get(stat), ranges);

describe("tierForPct", () => {
  it.each([[1, "S"], [0.9, "S"], [0.89, "A"], [0.75, "A"], [0.6, "B"], [0.4, "C"], [0.2, "D"], [0.14, "F"], [0, "F"]])(
    "%f -> %s", (pct, tier) => expect(tierForPct(pct)).toBe(tier));
});

describe("gradeStat (linear between min and max)", () => {
  it("spec example: 100–150 range, 150 = S and 100 = F", () => {
    const ranges = [R("critical_chance", 100, 150)];
    expect(grade("critical_chance", 150, ranges).tier).toBe("S");
    expect(grade("critical_chance", 100, ranges).tier).toBe("F");
    expect(grade("critical_chance", 125, ranges).pct).toBeCloseTo(0.5);
    expect(grade("critical_chance", 125, ranges).tier).toBe("C");
  });

  it("produces the spec's one-line explanation", () => {
    const g = grade("toxin_damage", 112, [R("toxin_damage", 56, 115)]);
    expect(g.tier).toBe("S");
    expect(g.explanation).toBe("112% Toxin is near the top of this weapon’s 56–115% range → S");
  });

  it("clamps values outside the range and flags them", () => {
    const g = grade("critical_chance", 170, [R("critical_chance", 100, 150)]);
    expect(g.tier).toBe("S");
    expect(g.pct).toBe(1);
    expect(g.outOfRange).toBe(true);
    expect(g.explanation).toContain("check the range data");
  });

  it("normalises to max rank before grading", () => {
    const ranges = [R("critical_chance", 100, 150)];
    const g = grade("critical_chance", 150 / 9, ranges, { rank: 0 });
    expect(g.valueAtMax).toBeCloseTo(150);
    expect(g.tier).toBe("S");
    expect(g.explanation).toContain("scaled to max rank");
  });

  it("curse: a smaller penalty is better", () => {
    const ranges = [R("zoom", -60, -30, { is_negative: true })];
    expect(grade("zoom", -30, ranges, { neg: true }).tier).toBe("S");
    expect(grade("zoom", -60, ranges, { neg: true }).tier).toBe("F");
    expect(grade("zoom", -30, ranges, { neg: true }).explanation).toContain("mild penalty");
  });

  it("inverted stat (recoil): more negative is better, as bonus AND the positive curse is smaller-is-better", () => {
    const bonus = [R("recoil", -90, -70)];
    expect(grade("recoil", -90, bonus).tier).toBe("S");
    expect(grade("recoil", -70, bonus).tier).toBe("F");
    const curse = [R("recoil", 30, 55, { is_negative: true })];
    expect(grade("recoil", 30, curse, { neg: true }).tier).toBe("S");
    expect(grade("recoil", 55, curse, { neg: true }).tier).toBe("F");
  });

  it("multiplier stats grade on the displayed xN value", () => {
    const g = grade("damage_vs_infested", 1.59, [R("damage_vs_infested", 1.48, 1.59)]);
    expect(g.tier).toBe("S");
    expect(g.explanation).toContain("x1.48–x1.59");
  });

  it("is ungraded (not wrong) when there is no range", () => {
    const g = grade("toxin_damage", 100, []);
    expect(g).toMatchObject({ tier: null, pct: null, range: null });
    expect(g.explanation).toContain("no roll range on file");
  });

  it("carries the placeholder flag through", () => {
    expect(grade("critical_chance", 120, [R("critical_chance", 100, 150, { is_placeholder: true })]).placeholder).toBe(true);
  });
});

describe("lookupRange / gradeRiven", () => {
  it("prefers the weapon row, falls back to '*', and separates curse rows", () => {
    const rs = [R("zoom", 1, 2, { weapon_slug: "*" }), R("zoom", 10, 20), R("zoom", -9, -1, { is_negative: true })];
    expect(lookupRange(rs, "soma", "zoom", false)?.min_roll).toBe(10);
    expect(lookupRange(rs, "boltor", "zoom", false)?.min_roll).toBe(1);
    expect(lookupRange(rs, "soma", "zoom", true)?.min_roll).toBe(-9);
    expect(lookupRange(rs, "soma", "toxin_damage", false)).toBeNull();
  });

  it("grades every stat independently — no riven-wide grade", () => {
    const rs = [R("critical_chance", 100, 150), R("toxin_damage", 56, 115)];
    const out = gradeRiven(
      { weapon_slug: "soma", rank: 8, stats: [{ stat: "critical_chance", value: 100, is_negative: false }, { stat: "toxin_damage", value: 115, is_negative: false }] },
      "Soma", attrs, rs);
    expect(out.map((g) => g.tier)).toEqual(["F", "S"]);
  });
});
