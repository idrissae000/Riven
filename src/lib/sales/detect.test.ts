import { describe, expect, it } from "vitest";
import { detectSales, summarizeSales, type OrderSnap, type SaleRow } from "./detect";

const o = (orderId: string, qty: number, price = 10, name = "Item"): OrderSnap => ({ orderId, slug: "item", name, rank: 0, qty, price });

describe("detectSales", () => {
  it("flags orders that vanished or shrank, at the price we last saw", () => {
    const prev = [o("a", 3, 40, "Flow"), o("b", 1, 20), o("c", 2, 5), o("d", 4, 7)];
    const now = [o("a", 1, 35, "Flow"), o("c", 2, 5), o("d", 9, 7)]; // a shrank by 2 (and was repriced), b vanished, c same, d grew
    expect(detectSales(prev, now)).toEqual([
      { orderId: "a", slug: "item", name: "Flow", qty: 2, priceEach: 40 },
      { orderId: "b", slug: "item", name: "Item", qty: 1, priceEach: 20 },
    ]);
  });
  it("is empty when nothing changed or there was nothing before", () => {
    expect(detectSales([o("a", 1)], [o("a", 1)])).toEqual([]);
    expect(detectSales([], [o("a", 1)])).toEqual([]);
  });
  it("labels ranked items", () => expect(detectSales([{ ...o("a", 1), rank: 5, name: "Arcane Energize" }], [])[0].name).toBe("Arcane Energize (rank 5)"));
});

describe("summarizeSales", () => {
  const NOW = Date.parse("2026-11-20T12:00:00Z");
  const row = (id: string, daysAgo: number, qty: number, price: number, status = "confirmed", name = "A"): SaleRow => ({ id, item_name: name, qty, price_each: price, sold_at: new Date(NOW - daysAgo * 86_400_000).toISOString(), status });
  const s = summarizeSales([row("1", 1, 2, 40), row("2", 6, 1, 100, "confirmed", "B"), row("3", 20, 1, 10), row("4", 2, 5, 99, "pending"), row("5", 60, 3, 5)], NOW);
  it("totals only confirmed sales over a week, a month and all time", () => expect(s).toMatchObject({ week: 180, month: 190, all: 205, count: 4 }));
  it("buckets by week, newest last, and ranks items", () => {
    expect(s.weekly).toHaveLength(8);
    expect(s.weekly[7].plat).toBe(180);
    expect(s.weekly[5].plat).toBe(10); // the 20-days-ago sale falls in the 3rd-latest week
    expect(s.top[0]).toEqual({ name: "A", plat: 105, units: 6 }); // 80 + 10 + 15 beats B's 100
    expect(s.top[1]).toEqual({ name: "B", plat: 100, units: 1 });
  });
});
