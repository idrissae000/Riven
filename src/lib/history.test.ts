import { describe, expect, it } from "vitest";
import { trendFromWeekly, trendOf } from "./history";

const pts = (...p: [string, number][]) => p.map(([day, price]) => ({ day, price }));
describe("trendOf", () => {
  it("needs two days", () => { expect(trendOf(undefined)).toBeNull(); expect(trendOf(pts(["2026-11-01", 5]))).toBeNull(); });
  it("measures change over the last 7 days", () => {
    const t = trendOf(pts(["2026-11-12", 15], ["2026-11-01", 5], ["2026-11-05", 10], ["2026-11-10", 12]))!;
    expect(t).toMatchObject({ changePct: 50, days: 7, dir: "up", prices: [5, 10, 12, 15] }); // base = 11-05 (10p), not 11-01
  });
  it("calls small moves flat and falls the other way", () => {
    expect(trendOf(pts(["2026-11-01", 20], ["2026-11-02", 20.5]))!.dir).toBe("flat");
    expect(trendOf(pts(["2026-11-01", 20], ["2026-11-02", 10]))).toMatchObject({ changePct: -50, dir: "down" });
  });
});

describe("trendFromWeekly", () => {
  it("compares the last week with 30 days ago", () => {
    expect(trendFromWeekly({ slug: "x", weekly: [5, 6, 8, 9, 10, 12], p7: 12, p30: 8, p90: 5 })).toMatchObject({ changePct: 50, days: 30, dir: "up" });
  });
  it("falls back to 90 days, then the oldest week, and needs two weeks", () => {
    expect(trendFromWeekly({ slug: "x", weekly: [10, 5], p7: 5, p30: null, p90: 10 })).toMatchObject({ changePct: -50, days: 90, dir: "down" });
    expect(trendFromWeekly({ slug: "x", weekly: [10, 10.2, 10.1], p7: 10.1, p30: null, p90: null })).toMatchObject({ days: 14, dir: "flat" });
    expect(trendFromWeekly({ slug: "x", weekly: [10], p7: 10, p30: null, p90: null })).toBeNull();
    expect(trendFromWeekly(undefined)).toBeNull();
  });
});
