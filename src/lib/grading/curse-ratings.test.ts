import { describe, expect, it } from "vitest";
import rivenCalc from "../../../data/rivencalc.json";
import file from "../../../data/curse-ratings.json";
import { CURSE_GRADES, CURSE_RATINGS, curseRatingFor, parseCurseRatings } from "./curse-ratings";
import type { RivenCalcData } from "@/lib/rivencalc/types";

describe("parseCurseRatings / curseRatingFor", () => {
  const r = parseCurseRatings({ _comment: "x", stats: { zoom: "S", critical_chance: "F" }, weapons: { _comment: "x", Felarx: { critical_chance: "S" } } } as never);
  it("ignores comment keys", () => { expect(Object.keys(r.stats)).toEqual(["zoom", "critical_chance"]); expect(Object.keys(r.weapons)).toEqual(["felarx"]); });
  it("the weapon's entry beats the stat's, case-insensitively", () => {
    expect(curseRatingFor(r, "critical_chance", "Felarx")).toEqual({ grade: "S", source: "weapon" });
    expect(curseRatingFor(r, "critical_chance", " felarx ")).toEqual({ grade: "S", source: "weapon" });
    expect(curseRatingFor(r, "critical_chance", "Soma")).toEqual({ grade: "F", source: "stat" });
    expect(curseRatingFor(r, "zoom", "Felarx")).toEqual({ grade: "S", source: "stat" });
  });
  it("unrated stats give null", () => expect(curseRatingFor(r, "multishot", "Soma")).toBeNull());
  it("refuses an unknown grade so a typo can't hide", () => {
    expect(() => parseCurseRatings({ stats: { zoom: "A+" } })).toThrow(/stats\.zoom.*A\+/);
    expect(() => parseCurseRatings({ weapons: { Felarx: { critical_chance: "E" } } })).toThrow(/Felarx/);
  });
});

describe("data/curse-ratings.json", () => {
  const data = rivenCalc as unknown as RivenCalcData;
  const known = new Set([...Object.keys(data.statSlugs), ...Object.keys(data.fallback?.units ?? {})]);
  it("only uses real stat slugs", () => {
    const unknown = Object.keys(CURSE_RATINGS.stats).concat(Object.values(CURSE_RATINGS.weapons).flatMap((w) => Object.keys(w))).filter((s) => !known.has(s));
    expect(unknown).toEqual([]);
  });
  it("only names weapons that exist", () => {
    const names = new Set(data.weapons.map((w) => w.name.toLowerCase()));
    expect(Object.keys(CURSE_RATINGS.weapons).filter((w) => !names.has(w))).toEqual([]);
  });
  it("only uses the allowed grades", () => {
    const all = [...Object.values(CURSE_RATINGS.stats), ...Object.values(CURSE_RATINGS.weapons).flatMap((w) => Object.values(w))];
    expect(all.every((g) => (CURSE_GRADES as readonly string[]).includes(g))).toBe(true);
  });
  it("has the Felarx override", () => expect(file.weapons.Felarx.critical_chance).toBe("S"));
});
