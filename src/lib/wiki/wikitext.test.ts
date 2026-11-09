import { describe, expect, it } from "vitest";
import { cleanWikitext, extractCompatNotes, extractDropSources, extractSection, extractTemplate, linkTargets } from "./wikitext";

describe("cleanWikitext", () => {
  it("resolves links, bold and common templates", () => {
    expect(cleanWikitext("Buy from [[Cavalero]] for {{sc|5,500}}, needs '''Rank 2 - Watcher''' with [[The Holdfasts|Holdfasts]].")).toBe(
      "Buy from Cavalero for 5,500 Credits, needs Rank 2 - Watcher with Holdfasts.");
    expect(cleanWikitext("for 10 {{Resource|Pathos Clamp}} on a [[Steel Path#Rewards|Steel Path]] week")).toBe("for 10 Pathos Clamp on a Steel Path week");
    expect(cleanWikitext("retired in {{ver|22.14}}<ref>x</ref>")).toBe("retired in Update 22.14");
    expect(cleanWikitext("{{WF|Loki}}'s {{A|Invisibility}}")).toBe("Loki's Invisibility");
  });
  it("handles nested templates and drops file links", () => {
    expect(cleanWikitext("{{Faction|{{E|Fire}}}} [[File:x.png|thumb]]ok")).toBe("Fire ok");
  });
});

describe("extractTemplate / extractSection", () => {
  it("extracts a brace-balanced template with nested templates and pipes in links", () => {
    const t = extractTemplate("a {{Acquisition|*[[A|b]] {{sc|1,000}}\n*two|header=no}} z", "Acquisition");
    expect(t).toBe("*[[A|b]] {{sc|1,000}}\n*two|header=no");
  });
  it("extracts a section up to the next heading", () => {
    expect(extractSection("==Effect==\nx\n==Acquisition==\n*a\n*b\n\n==Notes==\nn", "Acquisition")).toBe("*a\n*b");
  });
});

describe("extractDropSources", () => {
  it("parses the {{Acquisition}} template into structured sources", () => {
    const wt = `{{Acquisition|*Awarded for killing or capturing the [[Eidolon Gantulyst]].
*Dropped in Rotation C of [[Orphix]] [[Venus Proxima]] or [[Veil Proxima]] missions.
*Awarded at Tier 9 in [[The Duviri Paradox]] Circuit for Week 1.}}`;
    const d = extractDropSources(wt, "Arcane Acceleration");
    expect(d).toHaveLength(3);
    expect(d[0]).toMatchObject({ kind: "reward", links: ["Eidolon Gantulyst"] });
    expect(d[1]).toMatchObject({ kind: "drop", links: ["Orphix", "Venus Proxima", "Veil Proxima"], text: "Dropped in Rotation C of Orphix Venus Proxima or Veil Proxima missions." });
  });
  it("parses the ==Acquisition== section form with sub-bullets and vendors", () => {
    const wt = `==Acquisition==
*Can be bought from [[Roathe]] for 5 {{Resource|Maphica}}.
*May appear as a [[Steel Path]] reward weekly.
**Infernum 6 and 13 awards 1.
==Notes==
x`;
    const d = extractDropSources(wt, "Arcane Concentration");
    expect(d).toHaveLength(2);
    expect(d[0].kind).toBe("vendor");
    expect(d[1].details).toEqual(["Infernum 6 and 13 awards 1."]);
  });
  it("handles a single-paragraph template with header=no", () => {
    const d = extractDropSources("{{Acquisition|X can be purchased from [[Cavalero]] for {{sc|5,500}}.|header=no}}", "X");
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ kind: "vendor", text: "X can be purchased from Cavalero for 5,500 Credits." });
  });
  it("returns [] when there is no acquisition info", () => expect(extractDropSources("==Effect==\nx", "X")).toEqual([]));
});

describe("extractCompatNotes", () => {
  it("keeps top-level compatibility-flavoured bullets only", () => {
    const wt = `==Notes==
*Cannot be equipped on [[Exalted Weapon]]s like {{Weapon|Dex Pixia}}.
**sub bullet ignored for notes
*Short.
*Effect does not stack with itself, Duration of effect refreshes upon recast.
==Tips==
*Used on {{WF|Loki}}'s {{A|Invisibility}}, Arcane Concentration will benefit from the duration without a trigger.`;
    const n = extractCompatNotes(wt, "Arcane Concentration");
    expect(n[0]).toBe("Cannot be equipped on Exalted Weapons like Dex Pixia.");
    expect(n).toHaveLength(3);
    expect(n.join(" ")).not.toContain("sub bullet");
  });
});

describe("linkTargets", () => {
  it("returns page names without section anchors or display text", () => expect(linkTargets("[[Steel Path#Rewards|SP]] and [[The Circuit]] [[File:a.png]]")).toEqual(["Steel Path", "The Circuit"]));
});
