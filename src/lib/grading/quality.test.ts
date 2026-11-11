import { describe, expect, it } from "vitest";
import { rivenQuality, statQuality } from "./quality";
import type { StatGrade } from "./grade";

const g = (extra: Partial<StatGrade>): StatGrade => ({
  stat: "x", valueAtMax: 0, tier: "B", rollGrade: "B", gradeSource: "roll", pct: 0.5, range: null, ends: null, bands: [], outOfRange: false, context: null, note: null, explanation: "", ...extra,
});

describe("statQuality", () => {
  it("a positive stat is its position in the roll range", () => expect(statQuality(g({ pct: 0.8 }), false)).toBe(0.8));
  it("a curse with a fixed rating is worth that rating, whatever the roll", () => {
    expect(statQuality(g({ tier: "S", gradeSource: "curse-stat", pct: 0.1 }), true)).toBe(1);
    expect(statQuality(g({ tier: "F", gradeSource: "curse-weapon", pct: 0.9 }), true)).toBe(0);
  });
  it("an unrated curse falls back to its roll position", () => expect(statQuality(g({ gradeSource: "curse-unrated", pct: 0.7 }), true)).toBe(0.7));
  it("ungraded stats have no quality", () => expect(statQuality(g({ pct: null, tier: null }), false)).toBeNull());
});

describe("rivenQuality", () => {
  const pos = (pct: number | null) => g({ pct });
  it("is the mean of the positive stats when there's no curse", () => expect(rivenQuality([pos(0.4), pos(0.8)], [{ is_negative: false }, { is_negative: false }])).toBeCloseTo(0.6));
  it("blends in the curse (25%)", () => {
    const stats = [{ is_negative: false }, { is_negative: false }, { is_negative: true }];
    const good = rivenQuality([pos(0.5), pos(0.5), g({ tier: "S", gradeSource: "curse-stat" })], stats)!;
    const bad = rivenQuality([pos(0.5), pos(0.5), g({ tier: "F", gradeSource: "curse-stat" })], stats)!;
    expect(good).toBeCloseTo(0.625);
    expect(bad).toBeCloseTo(0.375);
    expect(good).toBeGreaterThan(bad);
  });
  it("skips ungraded stats and is null when nothing positive can be graded", () => {
    expect(rivenQuality([pos(null), pos(0.6)], [{ is_negative: false }, { is_negative: false }])).toBeCloseTo(0.6);
    expect(rivenQuality([pos(null)], [{ is_negative: false }])).toBeNull();
  });
});
