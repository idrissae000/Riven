import { describe, expect, it } from "vitest";
import { cached } from "./cache";

describe("cached", () => {
  it("serves from cache within TTL and dedupes concurrent loads", async () => {
    let calls = 0;
    const load = async () => { calls++; await new Promise((r) => setTimeout(r, 10)); return { n: calls }; };
    const [a, b] = await Promise.all([cached("k1", load), cached("k1", load)]);
    expect(calls).toBe(1);
    expect(a.data).toEqual(b.data);
    const c = await cached("k1", load);
    expect(c.fromCache).toBe(true);
    expect(calls).toBe(1);
  });

  it("reloads after expiry and serves stale on loader failure", async () => {
    let calls = 0;
    await cached("k2", async () => ({ v: ++calls }), { ttlMs: 5 });
    await new Promise((r) => setTimeout(r, 15));
    const r = await cached("k2", async () => { throw new Error("upstream down"); }, { ttlMs: 5 });
    expect(r.stale).toBe(true);
    expect(r.data).toEqual({ v: 1 });
  });

  it("propagates the error when there is nothing cached", async () => {
    await expect(cached("k3", async () => { throw new Error("nope"); })).rejects.toThrow("nope");
  });

  it("force-refresh is ignored while the entry is younger than minRefreshAgeMs", async () => {
    let calls = 0;
    const load = async () => ({ v: ++calls });
    await cached("k4", load);
    const r = await cached("k4", load, { force: true, minRefreshAgeMs: 60_000 });
    expect(calls).toBe(1);
    expect(r.fromCache).toBe(true);
    await cached("k4", load, { force: true });
    expect(calls).toBe(2);
  });
});
