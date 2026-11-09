import { describe, expect, it } from "vitest";
import { parseDataset } from "./import-parse";

describe("parseDataset", () => {
  it("parses CSV with header aliases and booleans", () => {
    const csv = "weapon,stat,min_roll,max_roll,is_negative\nsoma,critical_damage,128,157,false\n*,zoom,-60,-30,true\n";
    const r = parseDataset(csv, "x.csv");
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { weapon_slug: "soma", stat_slug: "critical_damage", is_negative: false, min_roll: 128, max_roll: 157 },
      { weapon_slug: "*", stat_slug: "zoom", is_negative: true, min_roll: -60, max_roll: -30 },
    ]);
  });

  it("parses the wrapped JSON form and carries placeholder metadata", () => {
    const r = parseDataset(JSON.stringify({ is_placeholder: true, source: "stub", ranges: [{ weapon: "soma", stat: "zoom", min: 1, max: 2 }] }), "x.json");
    expect(r.rows).toHaveLength(1);
    expect(r).toMatchObject({ is_placeholder: true, source: "stub" });
  });

  it("reports bad rows instead of importing them", () => {
    const r = parseDataset(JSON.stringify([
      { weapon: "soma", stat: "zoom", min: 5, max: 1 },
      { weapon: "soma", stat: "zoom", min: "x", max: 1 },
      { stat: "zoom", min: 1, max: 2 },
      { weapon: "soma", stat: "ok", min: 1, max: 2 },
      { weapon: "soma", stat: "ok", min: 1, max: 3 },
    ]), "x.json");
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toHaveLength(4);
    expect(r.errors.join("\n")).toMatch(/greater than max/);
    expect(r.errors.join("\n")).toMatch(/duplicate/);
  });

  it("rejects non-JSON", () => expect(parseDataset("{nope", "x.json").errors[0]).toMatch(/Invalid JSON/));
});
