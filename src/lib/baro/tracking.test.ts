import { describe, expect, it } from "vitest";
import { trackSinceBaro, trackingNote } from "./tracking";

const DAY = 86_400_000;
const ARRIVAL = "2026-11-13T14:00:00.000Z";
const a0 = Date.parse("2026-11-13T00:00:00Z");
const row = (off: number, avg: number, volume = 50) => ({ day: new Date(a0 + off * DAY).toISOString().slice(0, 10), avg, min: avg, max: avg, volume });

describe("trackSinceBaro", () => {
  // usual 40, dipped to 25 while he was here, recovering since
  const sales = [row(-3, 40), row(-2, 40), row(-1, 40), row(0, 28, 90), row(1, 25, 100), row(2, 26, 80), row(3, 30, 60), row(4, 34, 55), row(5, 36, 40), row(6, 38, 45)];
  const t = trackSinceBaro(sales, ARRIVAL);
  it("compares the price since he left with while he was here and with the usual", () => {
    expect(t).toMatchObject({ usual: 40, during: 26, latest: 38, recent: 36, vsDuring: 38, vsUsual: -10, days: 4 });
    expect(t.peak).toEqual({ price: 38, day: "2026-11-19" });
  });
  it("measures how fast it has been selling", () => {
    expect(t.duringVolume).toBe(90);
    expect(t.sinceVolume).toBe(50);
    expect(t.speed).toBe(0.56);
  });
  it("copes with no data", () => {
    expect(trackSinceBaro([], ARRIVAL)).toMatchObject({ usual: null, during: null, recent: null, vsDuring: null, speed: null, days: 0 });
  });
  it("writes a note", () => {
    const n = trackingNote(t, 41);
    expect(n).toContain("Up 38% on what it sold for while Baro was here");
    expect(n).toContain("Still 10% below its usual ≈ 40p");
    expect(n).toContain("Selling slower");
    expect(n).toContain("Asking prices (41p) are above recent sales");
    expect(trackingNote(trackSinceBaro([], ARRIVAL), null)).toContain("Not enough sales");
  });
});
