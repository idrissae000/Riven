import { describe, expect, it } from "vitest";
import { planAutoprice } from "./plan";

const NOW = Date.parse("2026-11-16T12:00:00Z");
const L = (platinum: number, seller = "x") => ({ platinum, quantity: 1, seller, status: "online" as const });
const base = { id: "a".repeat(24), platinum: 40, visible: true, type: "sell" as const, updatedAt: "2026-11-16T08:00:00Z" };
const s = { rule: "undercut" as const, floor: 30, maxDropPct: 15 };

describe("planAutoprice", () => {
  it("undercuts the cheapest seller by 1", () => {
    expect(planAutoprice(base, [L(36, "a"), L(38, "b"), L(39, "c")], "me", s, NOW)).toEqual({ action: "change", to: 35, cheapest: 36, note: null });
  });
  it("never goes below the floor", () => {
    expect(planAutoprice(base, [L(20, "a"), L(21, "b")], "me", { ...s, floor: 34 }, NOW)).toMatchObject({ action: "change", to: 34 });
  });
  it("caps one step at the max drop", () => {
    expect(planAutoprice({ ...base, platinum: 100 }, [L(50, "a"), L(52, "b")], "me", { ...s, floor: 10 }, NOW)).toMatchObject({ action: "change", to: 85, note: expect.stringContaining("15%") });
  });
  it("leaves alone orders that are fine, hidden, recent, buys, thin, or at the floor", () => {
    expect(planAutoprice(base, [L(45, "a"), L(46, "b")], "me", s, NOW)).toEqual({ action: "skip", why: "not-undercut" });
    expect(planAutoprice({ ...base, visible: false }, [L(30, "a"), L(31, "b")], "me", s, NOW)).toEqual({ action: "skip", why: "hidden" });
    expect(planAutoprice({ ...base, updatedAt: "2026-11-16T11:30:00Z" }, [L(30, "a"), L(31, "b")], "me", s, NOW)).toEqual({ action: "skip", why: "cooldown" });
    expect(planAutoprice({ ...base, type: "buy" }, [L(30, "a"), L(31, "b")], "me", s, NOW)).toEqual({ action: "skip", why: "not-sell" });
    expect(planAutoprice(base, [L(30, "a")], "me", s, NOW)).toEqual({ action: "skip", why: "thin-market" });
    expect(planAutoprice({ ...base, platinum: 30 }, [L(20, "a"), L(21, "b")], "me", s, NOW)).toEqual({ action: "skip", why: "at-floor" });
  });
  it("does not count your own listings against you", () => {
    expect(planAutoprice(base, [L(10, "Me"), L(45, "a"), L(46, "b")], "me", s, NOW)).toEqual({ action: "skip", why: "not-undercut" });
  });
});
