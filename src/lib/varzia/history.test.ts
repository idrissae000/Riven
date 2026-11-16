import { describe, expect, it } from "vitest";
import { rotationOutcome, varziaRows } from "./history";

const row = (day: string, avg: number, volume = 10) => ({ day, avg, min: avg, max: avg, volume });

describe("varziaRows", () => {
  it("maps sets and keeps everything else", () => {
    const sets = new Map([["saryn prime set", { slug: "saryn_prime_set", name: "Saryn Prime Set" }]]);
    const rows = varziaRows({ location: "Maroo", activation: "2026-10-01T00:00:00Z", expiry: "2026-11-01T00:00:00Z", items: [{ item: "Saryn Prime", regal: 3, aya: null }, { item: "Prime Pack", regal: 1, aya: null }] }, sets);
    expect(rows[0]).toMatchObject({ visit: "2026-10-01T00:00:00Z", ends: "2026-11-01T00:00:00Z", slug: "saryn_prime_set" });
    expect(rows[1].slug).toBeNull();
  });
});
describe("rotationOutcome", () => {
  it("compares the price at the end with the latest", () => {
    const sales = [row("2026-10-29", 100), row("2026-10-30", 100), row("2026-10-31", 100), row("2026-11-13", 130), row("2026-11-14", 130), row("2026-11-15", 130)];
    const o = rotationOutcome(sales, "2026-11-01T00:00:00Z", Date.parse("2026-11-16T12:00:00Z"));
    expect(o).toMatchObject({ atEnd: 100, now: 130, changePct: 30, daysSince: 15 });
  });
  it("copes with no data", () => expect(rotationOutcome([], "2026-11-01T00:00:00Z", Date.parse("2026-11-16T12:00:00Z")).changePct).toBeNull());
});
