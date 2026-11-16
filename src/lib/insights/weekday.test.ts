import { describe, expect, it } from "vitest";
import { dayDeviations, isReal, itemWeekdays, marketWeekdays, signTestP } from "./weekday";

// 2026-09-06 is a Sunday
const start = Date.parse("2026-09-06T00:00:00Z");
const mk = (n: number, f: (i: number, dow: number) => { avg: number; volume: number }) => Array.from({ length: n }, (_, i) => { const t = start + i * 86_400_000; const dow = new Date(t).getUTCDay(); const v = f(i, dow); return { day: new Date(t).toISOString().slice(0, 10), avg: v.avg, min: v.avg, max: v.avg, volume: v.volume }; });

describe("signTestP", () => {
  it("is exact", () => {
    expect(signTestP(10, 10)).toBeCloseTo(2 / 1024, 6);
    expect(signTestP(5, 10)).toBe(1);
    expect(signTestP(0, 0)).toBe(1);
  });
});
describe("dayDeviations", () => {
  it("needs the whole week around a day and skips today", () => {
    expect(dayDeviations(mk(5, () => ({ avg: 10, volume: 5 })), "2099-01-01")).toEqual([]);
    expect(dayDeviations(mk(30, () => ({ avg: 10, volume: 5 })), "2026-09-20").length).toBeLessThan(14);
  });
});
describe("itemWeekdays", () => {
  const sales = mk(91, (_, dow) => ({ avg: dow === 0 ? 24 : 20, volume: dow === 6 ? 20 : 10 })); // Sundays 20% pricier, Saturdays double the volume
  const w = itemWeekdays(sales, "2099-01-01");
  it("finds a weekday that is always pricier, and one that always trades more", () => {
    expect(w[0].price).toBeGreaterThan(15); // +16.7% against the week's average
    expect(w[0].priceP).toBeLessThan(0.01);
    expect(w[6].volume).toBeGreaterThan(40);
    expect(itemWeekdays(mk(91, () => ({ avg: 20, volume: 10 })), "2099-01-01")[3].priceP).toBe(1); // a flat item has no pattern
  });
  it("aggregates across items with an interval", () => {
    const flat = itemWeekdays(mk(91, () => ({ avg: 20, volume: 10 })), "2099-01-01");
    const m = marketWeekdays([w, w, w, itemWeekdays(mk(91, (_, dow) => ({ avg: dow === 0 ? 23 : 20, volume: 10 })), "2099-01-01")]);
    expect(isReal(m[0].price, m[0].priceLo, m[0].priceHi, 0.3)).toBe(true);
    const f = marketWeekdays([flat, flat, flat]);
    expect(isReal(f[3].price, f[3].priceLo, f[3].priceHi, 0.3)).toBe(false);
  });
});
