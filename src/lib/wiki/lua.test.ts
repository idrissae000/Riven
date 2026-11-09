import { describe, expect, it } from "vitest";
import { parseLuaModule } from "./lua";

describe("parseLuaModule", () => {
  it("parses nested tables, quoted keys, arrays, escapes, comments and bare values", () => {
    const v = parseLuaModule(`
      -- header comment
      return {
        Arcanes = {
          ["Arcane Acceleration"] = {
            CodexSecret = true, --[[ block ]]
            Description = "On Critical Hit:\\r\\n30% chance for +90% Fire Rate",
            InternalName ="/Lotus/Upgrades/X",
            MaxRank = 5,
            Introduced = "16",
            IncompatibilityTags = { "OPERATOR_SUIT" },
            UpgradeTypes = { "WEAPON_FIRE_RATE", "GAMEPLAY_FREE_REVIVE_COUNT" }
          },
          ["Empty"] = {},
        }
      }`) as { Arcanes: Record<string, Record<string, unknown>> };
    const a = v.Arcanes["Arcane Acceleration"];
    expect(a.CodexSecret).toBe(true);
    expect(a.Description).toBe("On Critical Hit:\r\n30% chance for +90% Fire Rate");
    expect(a.InternalName).toBe("/Lotus/Upgrades/X");
    expect(a.MaxRank).toBe(5);
    expect(a.UpgradeTypes).toEqual(["WEAPON_FIRE_RATE", "GAMEPLAY_FREE_REVIVE_COUNT"]);
    expect(v.Arcanes.Empty).toEqual([]);
  });

  it("throws a located error on garbage", () => {
    expect(() => parseLuaModule("return { A = @ }")).toThrow(/line 1/);
    expect(() => parseLuaModule('return { A = "x')).toThrow(/unterminated/);
  });
});

describe("parseLuaModule — `local X = {}` form", () => {
  it("parses the first table and ignores trailing code", () => {
    const v = parseLuaModule(`-- c\nlocal AbilityData = { Archived = { ["Bounce"] = { Powersuit = "Vauban", Key = 2 } } }\nreturn AbilityData`) as { Archived: Record<string, Record<string, unknown>> };
    expect(v.Archived.Bounce).toEqual({ Powersuit: "Vauban", Key: 2 });
  });
});
