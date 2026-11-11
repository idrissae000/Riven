import { describe, expect, it } from "vitest";
import { needsRefresh, vaultTotals, STALE_AFTER_MS, type VaultEstimate } from "./vault";

const E = (median: number | null, extra: Partial<VaultEstimate> = {}): VaultEstimate => ({ low: median == null ? null : median - 20, median, high: median == null ? null : median + 30, confidence: "medium", at: "2026-11-10T00:00:00Z", ...extra });

describe("vaultTotals", () => {
  it("adds up the estimates of the rivens that have one", () => {
    const t = vaultTotals(["a", "b", "c"], { a: E(100), b: E(250), c: E(null) });
    expect(t).toEqual({ median: 350, low: 310, high: 410, priced: 2, total: 3 });
  });
  it("counts a riven with no estimate as unpriced, not as zero worth", () => {
    expect(vaultTotals(["a"], { a: E(null) })).toMatchObject({ median: 0, priced: 0, total: 1 });
    expect(vaultTotals(["a", "b"], {})).toMatchObject({ priced: 0, total: 2 });
  });
  it("ignores estimates for rivens no longer in the list", () => expect(vaultTotals(["a"], { a: E(100), gone: E(999) }).median).toBe(100));
});

describe("needsRefresh", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  it("never priced → refresh", () => { expect(needsRefresh(undefined, now)).toBe(true); expect(needsRefresh(E(100, { at: null }), now)).toBe(true); });
  it("fresh → keep", () => expect(needsRefresh(E(100, { at: new Date(now - STALE_AFTER_MS / 2).toISOString() }), now)).toBe(false));
  it("old → refresh", () => expect(needsRefresh(E(100, { at: new Date(now - STALE_AFTER_MS - 1000).toISOString() }), now)).toBe(true));
  it("a recent 'no estimate' isn't retried straight away", () => expect(needsRefresh(E(null, { at: new Date(now - 60_000).toISOString() }), now)).toBe(false));
});
