import { describe, expect, it } from "vitest";
import { rivenInputSchema } from "./riven-schema";
import { fmtStat } from "./format";

const base = {
  weapon_slug: "soma", riven_name: "Acria-da", polarity: "madurai", mastery_rank: 11, rank: 0, rerolls: 0,
  stats: [
    { stat: "critical_damage", value: 112.3, is_negative: false },
    { stat: "multishot", value: 80, is_negative: false },
  ],
  has_negative: false, notes: null,
};

describe("rivenInputSchema", () => {
  it("accepts a 2-positive riven", () => expect(rivenInputSchema.safeParse(base).success).toBe(true));

  it("accepts 3 positive + 1 negative", () => {
    const r = rivenInputSchema.safeParse({
      ...base, has_negative: true,
      stats: [...base.stats, { stat: "zoom", value: 30, is_negative: false }, { stat: "recoil", value: -40, is_negative: true }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects has_negative mismatching stats", () =>
    expect(rivenInputSchema.safeParse({ ...base, has_negative: true }).success).toBe(false));

  it("rejects 4 positive stats", () => {
    const stats = ["a", "b", "c", "d"].map((stat) => ({ stat, value: 10, is_negative: false }));
    expect(rivenInputSchema.safeParse({ ...base, stats }).success).toBe(false);
  });

  it("rejects negative flag with a positive value and duplicate stats", () => {
    const bad = { ...base, has_negative: true, stats: [...base.stats, { stat: "zoom", value: 40, is_negative: true }] };
    expect(rivenInputSchema.safeParse(bad).success).toBe(false);
    const dup = { ...base, stats: [base.stats[0], base.stats[0]] };
    expect(rivenInputSchema.safeParse(dup).success).toBe(false);
  });
});

describe("fmtStat", () => {
  it("formats by unit with sign", () => {
    expect(fmtStat(112.3, "percent")).toBe("+112.3%");
    expect(fmtStat(-45, "percent")).toBe("-45%");
    expect(fmtStat(1.6, "multiply")).toBe("x1.6");
    expect(fmtStat(2.5, "seconds")).toBe("+2.5s");
    expect(fmtStat(3, null)).toBe("+3");
  });
});
