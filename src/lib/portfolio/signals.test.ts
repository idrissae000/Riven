import { describe, expect, it } from "vitest";
import { signalFor } from "./signals";

const base = { premiumPct: 0, momentumPct: 0, liquidity: "steady" as const, sharePct: 5 };
describe("signalFor", () => {
  it("sells things well above their normal price", () => {
    const s = signalFor({ ...base, premiumPct: 14, momentumPct: -4 });
    expect(s.signal).toBe("sell");
    expect(s.reasons.join(" ")).toContain("14% above");
    expect(s.reasons.join(" ")).toContain("turning down");
  });
  it("gets out of slow things that are sinking, but not fast ones", () => {
    expect(signalFor({ ...base, premiumPct: -12, momentumPct: -6, liquidity: "slow" }).signal).toBe("dump");
    expect(signalFor({ ...base, premiumPct: -12, momentumPct: -6, liquidity: "fast" }).signal).toBe("buy-more");
  });
  it("trims a concentrated holding and holds the rest", () => {
    expect(signalFor({ ...base, sharePct: 40 }).signal).toBe("trim");
    expect(signalFor(base).signal).toBe("hold");
    expect(signalFor({ ...base, premiumPct: null }).signal).toBe("none");
  });
  it("a high price outranks concentration", () => expect(signalFor({ ...base, premiumPct: 20, sharePct: 50 }).signal).toBe("sell"));
});
