import { describe, expect, it } from "vitest";
import { normalizeWorldState, withTraders } from "./worldstate";

const NOW = Date.parse("2026-11-16T12:00:00Z");
const base = normalizeWorldState({ earthCycle: { state: "day", expiry: "2026-11-16T14:00:00Z" } }, NOW - 3_600_000);

describe("withTraders", () => {
  it("lays fresh traders over an older copy and keeps the rest", () => {
    const s = withTraders(base, { voidTrader: { location: "Larunda Relay", activation: "2026-11-16T10:00:00Z", expiry: "2026-11-18T10:00:00Z", inventory: [{ item: "Primed Flow", ducats: 350, credits: 100000 }] } }, NOW);
    expect(s.cycles).toHaveLength(1);
    expect(s.baro?.items[0].item).toBe("Primed Flow");
    expect(s.fetchedAt).toBe(new Date(NOW).toISOString());
  });
  it("works with no older copy and no traders", () => {
    const s = withTraders(null, { voidTrader: null, vaultTrader: null }, NOW);
    expect(s.baro).toBeNull();
    expect(s.varzia).toBeNull();
  });
});
