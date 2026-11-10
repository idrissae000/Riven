import { describe, expect, it } from "vitest";
import { CODEX_FIXTURE as D } from "./fixture";
import { bandAsRangePercent, bandFor, bandValueRanges, categoryForWeapon, centerFor, deviationPct, findStat, layoutFor, rollRange, scaledBase } from "./compute";

const stat = (n: string) => findStat(D, n)!;
const L = (p: number, n: number) => layoutFor(D, p, n)!;

describe("the calculator's own worked example (from its 'How Do Rivens Work?' panel)", () => {
  it("rifle damage: 198% base, 3 pos/1 neg -> 185.6% center, 167.1% .. 204.2%", () => {
    expect(scaledBase(D, stat("Damage / Melee Damage"), 0)).toBe(198);
    const c = centerFor(D, stat("Damage / Melee Damage"), 0, L(3, 1), false)!;
    const r = rollRange(D, c);
    expect(c).toBeCloseTo(185.625, 3);
    expect(r.lo).toBeCloseTo(167.0625, 3);
    expect(r.hi).toBeCloseTo(204.1875, 3);
  });
  it("negative with a 108% base: center -81%, low -72.9%, high -89.1%", () => {
    const c = centerFor(D, stat("Cold Damage"), 0, L(3, 1), true)!;
    const r = rollRange(D, c);
    expect(c).toBeCloseTo(-81, 6);
    expect(r.lo).toBeCloseTo(-72.9, 6);
    expect(r.hi).toBeCloseTo(-89.1, 6);
    expect(r.min).toBeCloseTo(-89.1, 6); // signed min/max for storage/display
    expect(r.max).toBeCloseTo(-72.9, 6);
  });
});

describe("base values / layouts / roll", () => {
  it("applies the 1.2 disposition factor with the calculator's 4-decimal rounding", () => {
    expect(scaledBase(D, stat("Critical Chance"), 0)).toBe(179.988); // 149.99 * 1.2
    expect(scaledBase(D, stat("Critical Damage"), 0)).toBe(143.9964);
    expect(scaledBase(D, stat("Combo Duration"), 0)).toBeNull(); // not a rifle stat
  });
  it("knows all four layouts and nothing else", () => {
    expect(D.layouts.map((l) => l.id)).toEqual(["2/0", "2/1", "3/0", "3/1"]);
    expect(L(2, 1)).toMatchObject({ positiveMultiplier: 1.2375, negativeMultiplier: -0.495 });
    expect(layoutFor(D, 1, 0)).toBeNull();
    expect(layoutFor(D, 3, 2)).toBeNull();
  });
  it("Weapon Recoil is flipped: a bonus is negative, a curse is positive", () => {
    expect(centerFor(D, stat("Weapon Recoil"), 0, L(2, 0), false)!).toBeLessThan(0);
    expect(centerFor(D, stat("Weapon Recoil"), 0, L(2, 1), true)!).toBeGreaterThan(0);
  });
});

describe("grade bands (exactly the calculator's)", () => {
  const grade = (dev: number) => bandFor(D, dev).grade;
  it.each([[-10, "F"], [-9.6, "F"], [-9.5, "C-"], [-7.6, "C-"], [-7.5, "C"], [-5.5, "C+"], [-3.5, "B-"], [-1.5, "B"], [0, "B"], [1.49, "B"], [1.5, "B+"], [3.5, "A-"], [5.5, "A"], [7.5, "A+"], [9.49, "A+"], [9.5, "S"], [10, "S"]])(
    "deviation %f%% -> %s", (dev, g) => expect(grade(dev)).toBe(g));
  it("clamps beyond the roll range", () => { expect(grade(-12)).toBe("F"); expect(grade(11)).toBe("S"); });
  it("expresses each band as a share of the full min-max roll range (the 11 cutoffs)", () => {
    const pct = D.gradeBands.map((b) => [b.grade, bandAsRangePercent(D, b)] as const);
    expect(pct.map(([g, p]) => `${g} ${p.fromPct}-${p.toPct}`)).toEqual([
      "F 0-2.5", "C- 2.5-12.5", "C 12.5-22.5", "C+ 22.5-32.5", "B- 32.5-42.5", "B 42.5-57.5", "B+ 57.5-67.5", "A- 67.5-77.5", "A 77.5-87.5", "A+ 87.5-97.5", "S 97.5-100",
    ]);
  });
  it("deviation is sign-safe for curses and recoil", () => {
    const c = centerFor(D, stat("Cold Damage"), 0, L(3, 1), true)!; // -81
    expect(deviationPct(-89.1, c)).toBeCloseTo(10, 6);  // biggest-magnitude curse = top of the range
    expect(deviationPct(-72.9, c)).toBeCloseTo(-10, 6);
    const rc = centerFor(D, stat("Weapon Recoil"), 0, L(2, 0), false)!;
    expect(deviationPct(rc * 1.1, rc)).toBeCloseTo(10, 6);
  });
  it("value ranges per band reproduce the calculator's grade table (S best-first, F..S contiguous)", () => {
    const c = centerFor(D, stat("Damage / Melee Damage"), 0, L(3, 1), false)!;
    const t = bandValueRanges(D, c, "%");
    expect(t[0].grade).toBe("S");
    expect(t[t.length - 1].grade).toBe("F");
    expect(t[0].to).toBeCloseTo(204.1875, 3);
    expect(t[t.length - 1].from).toBeCloseTo(167.0625, 3);
  });
});

describe("categoryForWeapon", () => {
  it("uses the calculator's own weapon list first", () => {
    expect(categoryForWeapon(D, { name: "Soma", riven_type: "rifle" })).toEqual({ index: 0, note: null });
    expect(categoryForWeapon(D, { name: "Kuva Ayanga", riven_type: "rifle", group_name: "archgun" })).toEqual({ index: 3, note: null });
    expect(categoryForWeapon(D, { name: "Galatine", riven_type: "melee" })?.index).toBe(4);
  });
  it("kitguns that exist as primary + secondary use the Pistol values and say so", () => {
    const r = categoryForWeapon(D, { name: "Catchmoon", riven_type: "kitgun" })!;
    expect(r.index).toBe(2);
    expect(r.note).toMatch(/several variants/);
  });
  it("falls back to the market's riven type for weapons the calculator doesn't list", () => {
    const r = categoryForWeapon(D, { name: "Totally New Gun", riven_type: "shotgun" })!;
    expect(r.index).toBe(1);
    expect(r.note).toMatch(/isn't in the calculator/);
    expect(categoryForWeapon(D, { name: "X", riven_type: "rifle", group_name: "archgun" })?.index).toBe(3);
    expect(categoryForWeapon(D, { name: "X", riven_type: "weird" })).toBeNull();
  });
});
