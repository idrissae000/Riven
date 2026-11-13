import { describe, expect, it } from "vitest";
import { matchRead, mergeScans, valueScan } from "./scan-match";
import type { PrimePart } from "./types";

const P = (name: string): PrimePart => ({ slug: name.toLowerCase().replace(/ /g, "_"), name, kind: "part", type: "warframe", ducats: 45, setSlug: null, perSet: 1, relics: [], vaulted: null });
const parts = [P("Frost Prime Chassis Blueprint"), P("Frost Prime Neuroptics Blueprint"), P("Lex Prime Barrel"), P("Lex Prime Receiver")];

describe("matchRead", () => {
  it("matches exact names ignoring case and punctuation", () => {
    const r = matchRead([{ name: "lex prime  barrel", qty: 3 }], parts);
    expect(r.matched).toEqual([{ slug: "lex_prime_barrel", name: "Lex Prime Barrel", qty: 3, readAs: null, rank: 0, seenRank: null }]);
  });
  it("forgives a small misread but remembers what was read", () => {
    const r = matchRead([{ name: "Lex Prime Barel", qty: 1 }], parts);
    expect(r.matched[0]).toMatchObject({ slug: "lex_prime_barrel", readAs: "Lex Prime Barel" });
  });
  it("never guesses between two similar parts", () => {
    const r = matchRead([{ name: "Lex Prime Receiver Barrel", qty: 1 }, { name: "Totally Unknown Thing", qty: 2 }], parts);
    expect(r.matched).toEqual([]);
    expect(r.unmatched.map((u) => u.name)).toEqual(["Lex Prime Receiver Barrel", "Totally Unknown Thing"]);
  });
  it("defaults a missing quantity to 1 and treats a repeated line as the same stack", () => {
    const r = matchRead([{ name: "Lex Prime Barrel", qty: 0 }, { name: "Lex Prime Barrel", qty: 4 }], parts);
    expect(r.matched).toEqual([expect.objectContaining({ qty: 4 })]);
  });
});

describe("mergeScans", () => {
  it("takes the largest quantity for items seen in overlapping screenshots", () => {
    const a = matchRead([{ name: "Lex Prime Barrel", qty: 2 }, { name: "Mystery", qty: 1 }], parts);
    const b = matchRead([{ name: "Lex Prime Barrel", qty: 3 }, { name: "Lex Prime Receiver", qty: 1 }, { name: "mystery", qty: 1 }], parts);
    const m = mergeScans([a, b]);
    expect(m.matched.map((i) => [i.slug, i.qty])).toEqual([["lex_prime_barrel", 3], ["lex_prime_receiver", 1]]);
    expect(m.unmatched).toHaveLength(1);
  });
});

describe("mergeScans (mission rewards)", () => {
  it("adds up what each screenshot dropped", () => {
    const a = matchRead([{ name: "Lex Prime Barrel", qty: 1 }], parts);
    const b = matchRead([{ name: "Lex Prime Barrel", qty: 2 }, { name: "Lex Prime Receiver", qty: 1 }], parts);
    expect(mergeScans([a, b], "sum").matched.map((i) => [i.slug, i.qty])).toEqual([["lex_prime_barrel", 3], ["lex_prime_receiver", 1]]);
  });
});

describe("arcane matching", () => {
  const arcanes = [{ slug: "arcane_energize", name: "Arcane Energize" }, { slug: "magus_lockdown", name: "Magus Lockdown" }];
  const max = (s: string) => (s === "arcane_energize" ? 5 : 3);
  it("keeps max-rank tiles as max rank and everything else unranked", () => {
    const r = matchRead([{ name: "Arcane Energize", qty: 2, rank: 5 }, { name: "Arcane Energize", qty: 4, rank: 0 }, { name: "Magus Lockdown", qty: 1, rank: 2 }, { name: "magus lockdown", qty: 3 }], arcanes, max);
    expect(r.matched.map((i) => [i.slug, i.rank, i.qty, i.seenRank ?? null])).toEqual([["arcane_energize", 5, 2, null], ["arcane_energize", 0, 4, null], ["magus_lockdown", 0, 3, 2]]);
  });
  it("merges arcanes by name and rank", () => {
    const a = matchRead([{ name: "Arcane Energize", qty: 2, rank: 5 }], arcanes, max);
    const b = matchRead([{ name: "Arcane Energize", qty: 3, rank: 5 }, { name: "Arcane Energize", qty: 1 }], arcanes, max);
    expect(mergeScans([a, b], "sum").matched.map((i) => [i.rank, i.qty])).toEqual([[5, 5], [0, 1]]);
  });
});

describe("valueScan", () => {
  const prices: Record<string, number> = { lex_prime_barrel: 5, lex_prime_receiver: 40 };
  const m = matchRead([{ name: "Lex Prime Barrel", qty: 20 }, { name: "Lex Prime Receiver", qty: 1 }, { name: "Frost Prime Chassis Blueprint", qty: 1 }], parts);
  const v = valueScan(m.matched, (s) => prices[s] ?? null);
  it("orders by single-item price, most expensive first, unpriced last", () => expect(v.rows.map((r) => r.slug)).toEqual(["lex_prime_receiver", "lex_prime_barrel", "frost_prime_chassis_blueprint"]));
  it("totals quantity × price over priced items", () => expect(v).toMatchObject({ total: 140, priced: 2 }));
});
