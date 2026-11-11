import { describe, expect, it } from "vitest";
import { priceView } from "./price-view";

const row = (extra: Record<string, unknown> = {}) => ({ slug: "x", low: 3, avg5: 100, listings: 1, fetched_at: "2026-11-11T00:00:00Z", volume_48h: 0, sold_avg_48h: null, stats_at: null, max_low: 50, max_avg5: 60, max_listings: 5, ...extra }) as never;

describe("priceView", () => {
  it("explains a derived price in words", () => {
    const v = priceView(row(), 5)!;
    expect(v).toMatchObject({ price: 2.9, basis: "derived" });
    expect(v.note).toBe("max rank 60 ÷ 21 copies — the rank-0 market has too few listings");
  });
  it("has no note when the listings are trusted", () => expect(priceView(row({ listings: 5, avg5: 8, max_avg5: 200 }), 5)).toMatchObject({ price: 8, basis: "listings", note: null }));
  it("returns null before any data exists", () => expect(priceView(undefined, 5)).toBeNull());
  it("marks a row that was never fetched", () => expect(priceView(row({ fetched_at: null, avg5: null, listings: 0, max_avg5: null, max_listings: 0 }), 5)).toMatchObject({ fetched: false, basis: "none" }));
});
