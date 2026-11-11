import { describe, expect, it } from "vitest";
import { sourceLabel } from "./source-label";

const S = (kind: string, links: string[]) => ({ text: "", kind, links, details: [] }) as never;

describe("sourceLabel", () => {
  it("says how and where", () => {
    expect(sourceLabel([S("vendor", ["The Quills"])])).toBe("Buy: The Quills");
    expect(sourceLabel([S("reward", ["Eidolon Hydrolyst"]), S("drop", ["Orphix"])])).toBe("Reward: Eidolon Hydrolyst");
  });
  it("tidies wiki link names", () => {
    expect(sourceLabel([S("drop", ["Orphix (Mission)", "Veil Proxima"])])).toBe("Drop: Orphix");
    expect(sourceLabel([S("reward", ["Duviri/The Circuit/Rewards"])])).toBe("Reward: Duviri");
  });
  it("skips sources with no link and returns null when there's nothing", () => {
    expect(sourceLabel([S("drop", []), S("vendor", ["Hok"])])).toBe("Buy: Hok");
    expect(sourceLabel([])).toBeNull();
    expect(sourceLabel(null)).toBeNull();
  });
  it("shows other kinds without a verb", () => expect(sourceLabel([S("other", ["Tektolyst"])])).toBe("Tektolyst"));
});
