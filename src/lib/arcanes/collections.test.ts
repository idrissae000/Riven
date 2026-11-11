import { describe, expect, it } from "vitest";
import { parseCollections } from "./collections";
import { LOID_SECTION } from "./collections.fixture";

describe("parseCollections (real wiki text)", () => {
  const p = parseCollections(LOID_SECTION);
  const by = (n: string) => p.collections.find((c) => c.name === n)!;

  it("reads the price and number of arcanes", () => expect(p).toMatchObject({ vosfor: 200, credits: 50000, picks: 3 }));
  it("finds all nine collections", () => expect(p.collections.map((c) => c.name)).toEqual(["Cavia", "Duviri", "Eidolon", "Holdfasts", "Höllvania", "Necralisk", "Ostron", "Solaris", "Steel"]));
  it("gives each a url-safe id", () => expect(p.collections.map((c) => c.id)).toContain("hollvania"));

  it("Eidolon: 40/35/20/5 with 6/13/8/3 arcanes", () => {
    const e = by("Eidolon");
    expect(e.tiers.map((t) => t.chance)).toEqual([40, 35, 20, 5]);
    expect(e.tiers.map((t) => t.arcanes.length)).toEqual([6, 13, 8, 3]);
    expect(e.tiers[3].arcanes).toEqual(["Arcane Barrier", "Arcane Energize", "Arcane Grace"]);
  });
  it("Holdfasts: all 19 are rare", () => {
    const h = by("Holdfasts");
    expect(h.tiers.map((t) => t.chance)).toEqual([0, 0, 100, 0]);
    expect(h.tiers[2].arcanes).toHaveLength(19);
  });
  it("every collection's chances add to 100 and every pool matches its count", () => {
    for (const c of p.collections) expect(c.tiers.reduce((s, t) => s + t.chance, 0)).toBeCloseTo(100);
  });
});

describe("parseCollections refuses to guess", () => {
  it("a pool that doesn't match the wiki's own count", () => expect(() => parseCollections(LOID_SECTION.replace("{{Arcane|Arcane Grace}}", ""))).toThrow(/Eidolon Legendary.*3 arcanes.*lists 2/));
  it("chances that don't add up", () => expect(() => parseCollections(LOID_SECTION.replace("'''40%'''", "'''41%'''"))).toThrow(/add up to 101%/));
  it("a missing section", () => expect(() => parseCollections("nothing here")).toThrow(/loidogoffer/));
  it("a changed price", () => expect(() => parseCollections(LOID_SECTION.replace("each cost 200", "each cost lots"))).toThrow(/price/));
  it("a changed column order", () => expect(() => parseCollections(LOID_SECTION.replace("IconRare.png", "IconLegendary.png"))).toThrow(/rarity columns/));
});
