import { describe, expect, it } from "vitest";
import { analyseBaro, backed, baroTip, cycleStats, platPer100Ducats, projectPrice } from "./analysis";

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
  it("anchors on the usual price before Baro and counts how often it came back", () => {
    const a = analyseBaro(history(100, 0.8), ARRIVAL);
    expect(a).toMatchObject({ pre: 100, ratioShort: 1, ratioLong: 1, dipShare: 1, confidence: "strong" });
    expect(a.shortN).toBeGreaterThanOrEqual(4);
    expect(a.shortHits).toBe(a.shortN); // back to usual after every visit
    expect(backed(a, "short")).toBe(true);
  });
  it("sees no Baro effect in a flat price", () => {
    const a = analyseBaro(history(20, 1), ARRIVAL);
    expect(a).toMatchObject({ pre: 20, ratioShort: 1, ratioLong: 1, dipShare: 0 });
    expect(a.confidence).toBe("some"); // plenty of data, but no consistent dip
  });
  it("never projects above the usual price, however much the market trended up", () => {
    // a steadily rising price: every past visit's later windows are far above its pre-arrival level
    const a0 = Date.parse("2026-11-13T00:00:00Z");
    const rising = Array.from({ length: 90 }, (_, i) => ({ day: iso(a0 - (90 - i) * DAY), price: 20 + i * 0.4 }));
    const a = analyseBaro(rising, ARRIVAL);
    expect(a.ratioLong).toBeGreaterThan(1.2); // the raw ratio is inflated by the trend…
    expect(projectPrice(a, "long")).toBe(a.pre); // …but the estimate stops at the usual price
    expect(projectPrice(a, "short")).toBe(a.pre);
  });
  it("gives no estimate without enough visits of records", () => {
    const few = analyseBaro(history(100, 0.8).slice(-45), ARRIVAL); // ~3 cycles of data
    expect(few.shortN).toBeLessThan(4);
    expect(few.ratioShort).toBeNull();
    expect(projectPrice(few, "short")).toBeNull();
    expect(backed(few, "short")).toBe(false);
  });
  it("copes with no history", () => {
    expect(analyseBaro([], ARRIVAL)).toMatchObject({ pre: null, cycles: 0, ratioShort: null, ratioLong: null, shortN: 0, dipShare: null, confidence: "none" });
    expect(cycleStats([], ARRIVAL)).toHaveLength(6);
  });
  it("platinum per 100 ducats", () => {
    expect(platPer100Ducats(40, 350)).toBe(11.4);
    expect(platPer100Ducats(60, 0)).toBeNull();
  });
  it("writes a tip that sticks to the records", () => {
    const a = analyseBaro(history(40, 0.65), ARRIVAL);
    const tip = baroTip(25, a);
    expect(tip).toContain("sold for about 40p a day in the week before Baro arrived");
    expect(tip).toContain("asking 25p now (38% lower)");
    expect(tip).toMatch(/at least 95% of that level a week after in \d of \d past visits/);
    expect(baroTip(null, a)).toContain("no price to work from");
  });
});
