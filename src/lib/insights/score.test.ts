import { describe, expect, it } from "vitest";
import { scoreBaro, scoreDeals } from "./score";

const day = (d: string, avg: number, volume = 10) => ({ day: d, avg, min: avg, max: avg, volume });

describe("scoreDeals", () => {
  const preds = [
    { slug: "a", name: "A", made_on: "2026-10-01", ask: 20, typical: 24 },
    { slug: "b", name: "B", made_on: "2026-10-01", ask: 20, typical: 24 },
    { slug: "c", name: "C", made_on: "2026-11-10", ask: 20, typical: 24 },
  ];
  const sales = new Map([["a", [day("2026-10-09", 25), day("2026-10-12", 25)]], ["b", [day("2026-10-09", 19), day("2026-10-12", 19)]]]);
  it("scores deals old enough, leaves the rest pending", () => {
    const r = scoreDeals(preds, sales, "2026-11-16");
    expect(r.pending).toBe(1);
    expect(r.judged).toBe(2);
    expect(r.hits).toBe(1);
    expect(r.scored[0]).toMatchObject({ later: 25, returnPct: 25, hit: true });
    expect(r.scored[1].hit).toBe(false);
    expect(r.medianReturn).toBe(10);
  });
});
describe("scoreBaro", () => {
  it("compares the estimate with the later sold price, and counts pending and unestimated", () => {
    const past = [
      { name: "X", slug: "x", arrival: "2026-09-01T14:00:00Z", analysis: { pre: 40, ratioShort: null, ratioLong: 1 } },
      { name: "Y", slug: "y", arrival: "2026-09-01T14:00:00Z", analysis: { pre: 40, ratioShort: null, ratioLong: null } },
      { name: "Z", slug: "z", arrival: "2026-11-10T14:00:00Z", analysis: { pre: 40, ratioShort: null, ratioLong: 1 } },
    ];
    const sales = new Map([["x", [day("2026-09-20", 36), day("2026-09-25", 38)]]]);
    const r = scoreBaro(past, sales, "2026-11-16");
    expect(r.noEstimate).toBe(1);
    expect(r.pending).toBe(1);
    expect(r.scored[0]).toMatchObject({ estimate: 40, actual: 37, errPct: 8.1 });
    expect(r.within10).toBe(1);
  });
});
