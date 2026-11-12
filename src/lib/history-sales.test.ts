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
