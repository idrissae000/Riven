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
  it("measures how the price recovers after Baro", () => {
    const a = analyseBaro(history(100, 0.8), ARRIVAL);
    expect(a).toMatchObject({ ratioShort: 1.25, ratioLong: 1.25, dipShare: 1, confidence: "strong" });
    expect(a.cycles).toBeGreaterThanOrEqual(4);
  });
  it("sees no Baro effect in a flat price", () => {
    const a = analyseBaro(history(20, 1), ARRIVAL);
    expect(a).toMatchObject({ ratioShort: 1, ratioLong: 1, dipShare: 0 });
    expect(a.confidence).toBe("some"); // plenty of data, but no consistent dip
  });
  it("copes with no history", () => {
    expect(analyseBaro([], ARRIVAL)).toEqual({ cycles: 0, ratioShort: null, ratioLong: null, dipShare: null, confidence: "none" });
    expect(cycleStats([], ARRIVAL)).toHaveLength(6);
  });
  it("projects a sell price and platinum per 100 ducats", () => {
    const a = analyseBaro(history(100, 0.8), ARRIVAL);
    expect(projectPrice(40, a, "short")).toBe(50);
    expect(projectPrice(40, a, "long")).toBe(50);
    expect(projectPrice(null, a, "short")).toBeNull();
    expect(platPer100Ducats(60, 350)).toBe(17.1);
    expect(platPer100Ducats(60, 0)).toBeNull();
  });
  it("writes a tip", () => {
    const a = analyseBaro(history(100, 0.8), ARRIVAL);
    expect(baroTip(40, a)).toContain("Buy and hold about a week");
    expect(baroTip(40, a)).toContain("Held 2–4 weeks it has typically gained 25%");
    expect(baroTip(null, a)).toContain("no price to work from");
  });
});
