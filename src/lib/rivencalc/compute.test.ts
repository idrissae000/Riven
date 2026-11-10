import { describe, expect, it } from "vitest";
import { RIVENCALC_FIXTURE as D } from "./fixture";
import { bandAsRangePercent, bandFor, bandValueRanges, categoryForWeapon, centerOf, deviationPct, layoutFor, statFor, toCalcValue, toDisplayValue } from "./compute";

const RIFLE = "LotusRifleRandomModRare";

describe("grade bands (browse.wf floatToGrade)", () => {
  it("there are 11, contiguous from -10 to +10", () => {
    expect(D.gradeBands.map((b) => b.grade)).toEqual(["F", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+", "S"]);
    expect(D.gradeBands[0].lower).toBe(-10);
    expect(D.gradeBands[10].upper).toBe(10);
    for (let i = 1; i < D.gradeBands.length; i++) expect(D.gradeBands[i].lower).toBe(D.gradeBands[i - 1].upper);
  });
  it.each([[9.5, "S"], [9.49, "A+"], [7.5, "A+"], [5.5, "A"], [3.5, "A-"], [1.5, "B+"], [1.49, "B"], [0, "B"], [-1.5, "B"], [-1.51, "B-"], [-3.5, "B-"], [-3.51, "C+"], [-5.5, "C+"], [-7.5, "C"], [-9.5, "C-"], [-9.51, "F"], [-10, "F"], [12, "S"], [-12, "F"]])(
    "deviation %f → %s", (dev, grade) => expect(bandFor(D, dev).grade).toBe(grade));
  it("percent of the min–max range: S is the top 2.5%, B the middle 15%", () => {
    const s = D.gradeBands.find((b) => b.grade === "S")!, b = D.gradeBands.find((x) => x.grade === "B")!;
    expect(bandAsRangePercent(D, s)).toEqual({ fromPct: 97.5, toPct: 100 });
    expect(bandAsRangePercent(D, b)).toEqual({ fromPct: 42.5, toPct: 57.5 });
  });
  it("value ranges of the bands for a stat", () => {
    const rows = bandValueRanges(D, 100, "percent");
    expect(rows[0].grade).toBe("S"); expect(rows[0].from).toBeCloseTo(109.5); expect(rows[0].to).toBeCloseTo(110);
    expect(rows[10].grade).toBe("F"); expect(rows[10].from).toBeCloseTo(90); expect(rows[10].to).toBeCloseTo(90.5);
  });
});

describe("ranges", () => {
  it("the data is a flat ±10% roll around the center", () => {
    expect(D.roll).toEqual({ min: 0.9, max: 1.1 });
    for (const cat of Object.values(D.ranges)) for (const lay of Object.values(cat)) for (const [tag, [a, b]] of [...Object.entries(lay.buffs), ...Object.entries(lay.curses)]) {
      const unit = D.stats.find((s) => s.tag === tag)!.unit;
      const c = centerOf([a, b], unit);
      expect(toCalcValue(a, unit) / c).toBeCloseTo(0.9, 6);
      expect(toCalcValue(b, unit) / c).toBeCloseTo(1.1, 6);
    }
  });
  it("is tabulated at disposition 1.2, max rank", () => { expect(D.disposition).toBe(1.2); expect(D.rank).toBe(8); });
  it("layouts: 2/0, 2/1, 3/0, 3/1 and 1/1", () => {
    expect(D.layouts.map((l) => l.id)).toEqual(["2/0", "2/1", "3/0", "3/1", "1/1"]);
    expect(layoutFor(D, 3, 1)?.id).toBe("3/1");
    expect(layoutFor(D, 4, 0)).toBeNull();
  });
  it("curse tables exist only for layouts with a curse", () => {
    expect(Object.keys(D.ranges[RIFLE]["3/0"].curses)).toHaveLength(0);
    expect(Object.keys(D.ranges[RIFLE]["3/1"].curses).length).toBeGreaterThan(0);
  });
  it("x stats are measured above ×1", () => {
    expect(toCalcValue(1.5, "multiply")).toBeCloseTo(0.5);
    expect(toDisplayValue(0.5, "multiply")).toBeCloseTo(1.5);
    const r = statFor(D, "damage_vs_infested", RIFLE, false, "3/1");
    expect(r.kind === "ok" && centerOf(r.range, r.stat.unit)).toBeCloseTo(0.5062, 3);
  });
  it("the Unified-Codex fallback only fills gaps", () => {
    const blast = statFor(D, "blast", RIFLE, false, "2/0");
    expect(blast.kind === "ok" && blast.fallback).toBe(true);
    expect(blast.kind === "ok" && blast.range[0]).toBeCloseTo(96.228, 2); // 90 × 1.2 × 0.99 × 0.9
    const zoom = statFor(D, "zoom", RIFLE, false, "2/0");
    expect(zoom.kind === "ok" && zoom.fallback).toBe(false); // browse.wf has it for rifles
    const sg = statFor(D, "zoom", "LotusShotgunRandomModRare", false, "2/0");
    expect(sg.kind === "ok" && sg.fallback).toBe(true); // …but not for shotguns
    expect(D.fallback!.ranges[RIFLE]["1/1"]).toBeUndefined(); // the Codex has no 1+/1- layout
  });
  it("deviation is sign-safe", () => {
    expect(deviationPct(-110, -100)).toBeCloseTo(10);
    expect(deviationPct(90, 100)).toBeCloseTo(-10);
  });
  it("a slug with a ranged and a melee tag picks the one the category lists", () => {
    const rifle = statFor(D, "base_damage_/_melee_damage", RIFLE, false, "2/0");
    const melee = statFor(D, "base_damage_/_melee_damage", "PlayerMeleeWeaponRandomModRare", false, "2/0");
    expect(rifle.kind === "ok" && rifle.tag).toBe("WeaponDamageAmountMod");
    expect(melee.kind === "ok" && melee.tag).toBe("WeaponMeleeDamageMod");
    expect(statFor(D, "nope", RIFLE, false, "2/0").kind).toBe("unlisted");
    expect(statFor(D, "blast", RIFLE, true, "2/1").kind).toBe("cannot-roll"); // a fallback stat that can't be a penalty
    expect(statFor(D, "combo_duration", RIFLE, false, "2/0").kind).toBe("cannot-roll");
  });
});

describe("categoryForWeapon", () => {
  it("looks weapons up in the calculator's own list", () => {
    expect(categoryForWeapon(D, { name: "Soma Prime", riven_type: "rifle" })).toMatchObject({ name: "Rifle", note: null });
    expect(categoryForWeapon(D, { name: "kuva ayanga", riven_type: "rifle", group_name: "archgun" })).toMatchObject({ name: "Archgun", note: null });
    expect(categoryForWeapon(D, { name: "Catchmoon", riven_type: "kitgun" })).toMatchObject({ name: "Kitgun", note: null });
    expect(categoryForWeapon(D, { name: "Balla", riven_type: "zaw" })).toMatchObject({ name: "Zaw", note: null });
  });
  it("falls back to the Warframe Market riven type, with a note", () => {
    const c = categoryForWeapon(D, { name: "Mystery", riven_type: "pistol" });
    expect(c).toMatchObject({ name: "Pistol" });
    expect(c?.note).toContain("isn't in the calculator's weapon list");
    expect(categoryForWeapon(D, { name: "Mystery", riven_type: "wand" })).toBeNull();
  });
});
