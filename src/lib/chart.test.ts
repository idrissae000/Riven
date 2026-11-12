import { describe, expect, it } from "vitest";
import { mergeDays, nearestIndex, niceTicks, rangeStats } from "./chart";

const s = (day: string, avg: number, volume = 1, min = avg, max = avg) => ({ day, avg, min, max, volume });
describe("mergeDays", () => {
  it("joins sales and asking prices by day and trims to the window", () => {
    const d = mergeDays([s("2026-11-01", 5), s("2026-11-10", 8), s("2026-11-12", 9)], [{ day: "2026-11-12", price: 10 }, { day: "2026-11-11", price: 9 }], 3);
    expect(d.map((x) => [x.day, x.sold, x.asking])).toEqual([["2026-11-10", 8, null], ["2026-11-11", null, 9], ["2026-11-12", 9, 10]]);
  });
  it("is empty without data", () => expect(mergeDays([], [], 30)).toEqual([]));
});
describe("niceTicks", () => {
  it("gives round gridlines", () => expect(niceTicks(0, 20, 4)).toEqual([0, 5, 10, 15, 20]));
  it("copes with a flat range", () => expect(niceTicks(7, 7)).toEqual([7]));
});
describe("nearestIndex", () => it("picks the closest x", () => expect(nearestIndex([0, 10, 50], 30)).toBe(1)));
describe("rangeStats", () => {
  it("weights the average by units sold", () => {
    const st = rangeStats(mergeDays([s("2026-11-01", 10, 1, 8, 12), s("2026-11-02", 20, 3, 18, 22)], [], 30));
    expect(st).toEqual({ low: 8, high: 22, avg: 17.5, units: 4, changePct: 100 });
  });
});
