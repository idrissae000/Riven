import { describe, expect, it } from "vitest";
import { trendOf } from "./history";

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
