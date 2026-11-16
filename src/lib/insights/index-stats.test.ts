import { describe, expect, it } from "vitest";
import { indexStats, smooth } from "./index-stats";

const pts = (xs: number[]) => xs.map((idx, i) => ({ day: `d${String(i).padStart(2, "0")}`, idx }));
describe("indexStats", () => {
  it("reads level, changes and range position", () => {
    const xs = Array.from({ length: 60 }, (_, i) => 100 - i * 0.5); // falls steadily from 100 to 70.5
    const s = indexStats(pts(xs))!;
    expect(s.now).toBeCloseTo(71.2, 0);
    expect(s.change7!).toBeLessThan(0);
    expect(s.change30!).toBeLessThan(s.change7!);
    expect(s.position).toBeLessThan(5);
    expect(s.high.idx).toBeGreaterThan(s.low.idx);
  });
  it("needs two weeks of points", () => expect(indexStats(pts([100, 101, 102]))).toBeNull());
  it("smooths with a 3-day average", () => expect(smooth(pts([10, 20, 30])).map((p) => p.idx)).toEqual([10, 15, 20]));
});
