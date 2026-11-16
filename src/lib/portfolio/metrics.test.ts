import { describe, expect, it } from "vitest";
import { allocation, marketSpeed, priceChange7d, profit, vsMarket } from "./metrics";

const NOW = Date.parse("2026-11-16T12:00:00Z");
const d = (off: number) => new Date(Date.parse("2026-11-16T00:00:00Z") + off * 86_400_000).toISOString().slice(0, 10);
const row = (off: number, avg: number, volume: number) => ({ day: d(off), avg, min: avg, max: avg, volume });

describe("marketSpeed", () => {
  it("averages complete days and ignores today", () => {
    const rows = [...Array.from({ length: 14 }, (_, i) => row(-14 + i, 20, 10)), row(0, 20, 999)];
    expect(marketSpeed(rows, NOW)).toEqual({ perDay: 10, liquidity: "fast" });
  });
  it("tiers slow and stuck", () => {
    expect(marketSpeed([row(-3, 5, 1), row(-2, 5, 0), row(-1, 5, 1)], NOW).liquidity).toBe("slow");
    expect(marketSpeed([], NOW).liquidity).toBe("unknown");
  });
});
describe("priceChange7d", () => {
  it("compares the last week with the one before", () => {
    const rows = [...Array.from({ length: 7 }, (_, i) => row(-14 + i, 20, 5)), ...Array.from({ length: 7 }, (_, i) => row(-7 + i, 25, 5))];
    expect(priceChange7d(rows, NOW)).toBe(25);
    expect(priceChange7d([row(-1, 5, 5)], NOW)).toBeNull();
  });
});
describe("allocation", () => {
  it("splits by kind and flags slow money", () => {
    const a = allocation([{ key: "a", name: "A", value: 60, kind: "part", liquidity: "fast" }, { key: "b", name: "B", value: 30, kind: "arcane", liquidity: "slow" }, { key: "c", name: "C", value: 10, kind: "riven", liquidity: "unknown" }]);
    expect(a).toMatchObject({ total: 100, parts: 60, arcanes: 30, rivens: 10, slowValue: 30, slowShare: 30, top3: 100 });
  });
});
describe("profit", () => {
  const sales = [
    { item_name: "X", qty: 2, price_each: 30, cost_each: 10, sold_at: "2026-11-15T00:00:00Z", status: "confirmed" },
    { item_name: "Y", qty: 1, price_each: 50, cost_each: null, sold_at: "2026-11-14T00:00:00Z", status: "confirmed" },
    { item_name: "Z", qty: 1, price_each: 99, cost_each: null, sold_at: "2026-11-14T00:00:00Z", status: "pending" },
  ];
  it("counts only confirmed sales and profits only those with a cost", () => {
    expect(profit(sales, NOW)).toMatchObject({ revenue: 110, units: 3, cost: 20, profit: 40, margin: 200, costedShare: 50 });
  });
  it("compares with the market", () => {
    expect(vsMarket(sales, (n) => (n === "X" ? 25 : null))).toEqual([{ name: "X", soldAvg: 30, now: 25, diffPct: 20, units: 2 }]);
  });
});

import { insights, type HoldingRow } from "./metrics";
describe("insights", () => {
  const rows: HoldingRow[] = [
    { name: "Big", value: 70, share: 70, change7d: 15, liquidity: "slow", perDay: 0.5 },
    { name: "Small", value: 30, share: 30, change7d: -12, liquidity: "fast", perDay: 8 },
  ];
  it("calls out concentration, slow money and the movers", () => {
    const out = insights(rows, allocation(rows.map((r) => ({ key: r.name, name: r.name, value: r.value, kind: "part" as const, liquidity: r.liquidity }))));
    expect(out.some((t) => t.includes("Big is 70%"))).toBe(true);
    expect(out.some((t) => t.includes("70p (70%)"))).toBe(true);
    expect(out.some((t) => t.includes("Up this week: Big (+15%)"))).toBe(true);
    expect(out.some((t) => t.includes("Down this week: Small (-12%)"))).toBe(true);
  });
  it("is quiet for an empty portfolio", () => expect(insights([], allocation([]))).toEqual([]));
});
