import { describe, expect, it } from "vitest";
import { extractJson, normalizeScan, parseNumber } from "./normalize";
import { fitWithin } from "../image-prep";

describe("parseNumber", () => {
  it.each([["+112.3%", 112.3], ["−30.5%", -30.5], ["x1.54", 1.54], ["-45", -45], ["12,5%", 12.5], [7, 7]])("%s", (i, o) => expect(parseNumber(i)).toBe(o));
  it("rejects junk", () => { expect(parseNumber("abc")).toBeNull(); expect(parseNumber(null)).toBeNull(); expect(parseNumber(NaN)).toBeNull(); });
});

describe("normalizeScan", () => {
  it("coerces a clean result", () => {
    const r = normalizeScan({ weapon_name: " Soma ", riven_name: "Crita-cron", polarity: "Madurai", mastery_rank: 11, rank: 8, rerolls: 3,
      stats: [{ name: "Critical Chance", value: 150.2, shown: "+150.2%", is_curse: false }, { name: "Zoom", value: -40, shown: "-40%", is_curse: true }], notes: null });
    expect(r).toMatchObject({ weapon_name: "Soma", polarity: "madurai", mastery_rank: 11, rank: 8, rerolls: 3 });
    expect(r.stats).toHaveLength(2);
  });
  it("treats sentinels / out-of-range as unknown instead of failing", () => {
    const r = normalizeScan({ weapon_name: "", polarity: "unknown", mastery_rank: -1, rank: 99, rerolls: "abc", stats: [] });
    expect(r).toMatchObject({ weapon_name: null, polarity: null, mastery_rank: null, rank: null, rerolls: null, stats: [] });
  });
  it("maps polarity symbols", () => {
    expect(normalizeScan({ polarity: "V" }).polarity).toBe("madurai");
    expect(normalizeScan({ polarity: "D" }).polarity).toBe("vazarin");
    expect(normalizeScan({ polarity: "-" }).polarity).toBe("naramon");
  });
  it("takes the sign from the printed text and parses string values", () => {
    const r = normalizeScan({ stats: [{ name: "Zoom", value: "30.5", shown: "−30.5%", is_curse: true }, { name: "Multishot", value: "+90.1%" }] });
    expect(r.stats[0].value).toBe(-30.5);
    expect(r.stats[1]).toMatchObject({ value: 90.1, is_curse: false });
  });
  it("drops unusable stat lines, caps at 4, and keeps at most one curse", () => {
    const r = normalizeScan({ stats: [{ name: "", value: 1 }, { name: "A", value: "x" }, ...["B", "C", "D", "E", "F"].map((n) => ({ name: n, value: 1, is_curse: true }))] });
    expect(r.stats).toHaveLength(4);
    expect(r.stats.filter((s) => s.is_curse)).toHaveLength(1);
  });
  it("survives garbage input", () => {
    expect(normalizeScan(null).stats).toEqual([]);
    expect(normalizeScan("nope").weapon_name).toBeNull();
  });
});

describe("extractJson", () => {
  it("handles fenced and chatty replies", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```\nDone')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a": {"b": 2}} thanks')).toEqual({ a: { b: 2 } });
  });
  it("throws when there is no JSON", () => expect(() => extractJson("nothing here")).toThrow());
});

describe("fitWithin", () => {
  it("downscales the longest edge and never upscales", () => {
    expect(fitWithin(4000, 3000, 1800)).toEqual({ width: 1800, height: 1350 });
    expect(fitWithin(3000, 4000, 1800)).toEqual({ width: 1350, height: 1800 });
    expect(fitWithin(800, 600, 1800)).toEqual({ width: 800, height: 600 });
  });
});
