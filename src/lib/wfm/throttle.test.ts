import { describe, expect, it } from "vitest";
import { Throttle } from "./throttle";

describe("Throttle", () => {
  it("spaces task starts by at least the interval and keeps order", async () => {
    const t = new Throttle(60);
    const starts: number[] = [];
    const order: number[] = [];
    await Promise.all([0, 1, 2, 3].map((i) => t.schedule(async () => { starts.push(Date.now()); order.push(i); })));
    expect(order).toEqual([0, 1, 2, 3]);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(55);
  });

  it("keeps working after a task throws", async () => {
    const t = new Throttle(5);
    await expect(t.schedule(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    await expect(t.schedule(async () => 42)).resolves.toBe(42);
  });
});
