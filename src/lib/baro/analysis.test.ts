import { describe, expect, it } from "vitest";
import { analyseBaro, baroTip, cycleStats, platPer100Ducats, projectPrice } from "./analysis";

const DAY = 86_400_000;
const ARRIVAL = "2026-11-13T14:00:00.000Z";
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** `base` every day, except `dip` × base on the first 3 days of every 14-day Baro cycle counting back from the current arrival. */
function history(base: number, dip: number) {
  const a0 = Date.parse("2026-11-13T00:00:00Z");
  const out: { day: string; price: number }[] = [];
  for (let off = -90; off <= -1; off++) {
    const phase = ((off % 14) + 14) % 14;
    out.push({ day: iso(a0 + off * DAY), price: phase <= 2 ? base * dip : base });
  }
  return out;
}

describe("Baro analysis", () => {
  it("anchors on the usual price before Baro and measures the rebound", () => {
    const a = analyseBaro(history(100, 0.8), ARRIVAL);
    expect(a).toMatchObject({ pre: 100, ratioShort: 1, ratioLong: 1, dipShare: 1, confidence: "strong" });
    expect(a.cycles).toBeGreaterThanOrEqual(4);
  });
  it("sees no Baro effect in a flat price", () => {
    const a = analyseBaro(history(20, 1), ARRIVAL);
    expect(a).toMatchObject({ pre: 20, ratioShort: 1, ratioLong: 1, dipShare: 0 });
    expect(a.confidence).toBe("some"); // plenty of data, but no consistent dip
  });
  it("copes with no history", () => {
    expect(analyseBaro([], ARRIVAL)).toEqual({ pre: null, cycles: 0, ratioShort: null, ratioLong: null, dipShare: null, confidence: "none" });
    expect(cycleStats([], ARRIVAL)).toHaveLength(6);
  });
  it("projects from the usual price, not from today's depressed one (a 40p mod pushed down to 25p)", () => {
    const a = analyseBaro(history(40, 0.65), ARRIVAL);
    expect(a.pre).toBe(40);
    expect(projectPrice(a, "short")).toBe(40);
    expect(projectPrice(a, "long")).toBe(40);
    expect(projectPrice({ pre: null, ratioShort: 1, ratioLong: 1 }, "short")).toBeNull();
    expect(platPer100Ducats(40, 350)).toBe(11.4);
    expect(platPer100Ducats(60, 0)).toBeNull();
  });
  it("writes a tip that names the usual price and the discount", () => {
    const a = analyseBaro(history(40, 0.65), ARRIVAL);
    const tip = baroTip(25, a);
    expect(tip).toContain("usually sells for about 40p");
    expect(tip).toContain("25p now (38% below)");
    expect(tip).toContain("Buy and hold about a week");
    expect(baroTip(39, a)).toContain("isn’t discounted much");
    expect(baroTip(null, a)).toContain("no price to work from");
  });
});
