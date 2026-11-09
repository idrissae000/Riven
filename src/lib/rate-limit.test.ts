import { describe, expect, it } from "vitest";
import { clientIp, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit, then blocks until the window resets", () => {
    const t = 1_000_000;
    expect(rateLimit("a", 2, 1000, t).ok).toBe(true);
    expect(rateLimit("a", 2, 1000, t + 1).ok).toBe(true);
    const blocked = rateLimit("a", 2, 1000, t + 2);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(rateLimit("a", 2, 1000, t + 1001).ok).toBe(true);
  });
  it("tracks keys independently", () => {
    expect(rateLimit("x", 1, 1000, 5).ok).toBe(true);
    expect(rateLimit("y", 1, 1000, 5).ok).toBe(true);
    expect(rateLimit("x", 1, 1000, 6).ok).toBe(false);
  });
  it("reads the client IP from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
