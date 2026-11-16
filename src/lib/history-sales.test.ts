import { describe, expect, it } from "vitest";
import { reduceSales } from "./history-sales";

describe("reduceSales", () => {
  it("keeps rank-0 days in order, using the volume-weighted price", () => {
    const r = reduceSales([
      { datetime: "2026-11-02T00:00:00.000+00:00", volume: 5, min_price: 6, max_price: 9, avg_price: 7, wa_price: 7.4, mod_rank: 0 },
      { datetime: "2026-11-01T00:00:00.000+00:00", volume: 3, min_price: 5, max_price: 6, avg_price: 5 }, // no rank = rank 0
      { datetime: "2026-11-02T00:00:00.000+00:00", volume: 9, avg_price: 90, mod_rank: 5 }, // max-rank trades excluded
      { datetime: "2026-11-03T00:00:00.000+00:00", volume: 0, avg_price: 0, mod_rank: 0 }, // no price
    ]);
    expect(r).toEqual([{ day: "2026-11-01", avg: 5, min: 5, max: 6, volume: 3 }, { day: "2026-11-02", avg: 7.4, min: 6, max: 9, volume: 5 }]);
  });
  it("handles nothing", () => expect(reduceSales(undefined)).toEqual([]));
});

import { recentDays } from "./history-sales";
describe("recentDays", () => {
  const h = (datetime: string, volume: number, wa: number, min: number, max: number, rank = 0) => ({ datetime, volume, wa_price: wa, avg_price: wa, min_price: min, max_price: max, mod_rank: rank });
  it("turns the hourly rows of days the daily feed lacks into one partial day", () => {
    const daily = [{ day: "2026-11-15", avg: 24.5, min: 20, max: 30, volume: 99 }];
    const r = recentDays([h("2026-11-15T22:00:00.000+00:00", 5, 24, 20, 25), h("2026-11-16T03:00:00.000+00:00", 2, 20, 18, 22), h("2026-11-16T09:00:00.000+00:00", 6, 26, 24, 30), h("2026-11-16T10:00:00.000+00:00", 1, 40, 40, 40, 5)], daily);
    expect(r).toEqual([{ day: "2026-11-16", avg: 24.5, min: 18, max: 30, volume: 8 }]); // (2×20 + 6×26)/8; rank-5 trade and the already-covered day ignored
  });
  it("is empty without hourly data", () => expect(recentDays(undefined, [])).toEqual([]));
});
