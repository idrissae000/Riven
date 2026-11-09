import { describe, expect, it } from "vitest";
import { decodeRiven, encodeRiven } from "./riven-share";
import type { RivenInput } from "./riven-schema";

const riven: RivenInput = {
  weapon_slug: "soma", riven_name: "Crita-cron", polarity: "madurai", mastery_rank: 11, rank: 8, rerolls: 3,
  stats: [{ stat: "critical_chance", value: 150.2, is_negative: false }, { stat: "critical_damage", value: 120, is_negative: false }, { stat: "zoom", value: -40, is_negative: true }],
  has_negative: true, notes: null,
};

describe("riven share encoding", () => {
  it("round-trips and is URL-safe", () => {
    const enc = encodeRiven(riven);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeRiven(enc)).toEqual(riven);
  });
  it("handles non-ASCII text", () => {
    const r = { ...riven, riven_name: "Crïta-çron" };
    expect(decodeRiven(encodeRiven(r))?.riven_name).toBe("Crïta-çron");
  });
  it("rejects garbage, tampered-invalid and oversized input instead of throwing", () => {
    expect(decodeRiven(undefined)).toBeNull();
    expect(decodeRiven("not base64 !!")).toBeNull();
    expect(decodeRiven(encodeRiven({ ...riven, stats: [] }))).toBeNull(); // fails schema (needs >= 2 stats)
    expect(decodeRiven("a".repeat(5000))).toBeNull();
  });
});
