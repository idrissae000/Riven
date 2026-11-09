import { describe, expect, it } from "vitest";
import { cleanWikitext, extractAbilityLists, extractCompatNotes, extractDropSources, extractSection, extractTemplate, linkTargets } from "./wikitext";

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
  it("uses the text after a bare {{Acquisition|name=...}} template (newer wiki pages)", () => {
    const wt = `{{Acquisition|name={{PAGENAME}}}}\n\nCan be bought from [[Hunhow]] at [[Pontis Tower]] for 10 {{Resource|Emerald Talent}}.\n\n==Notes==\n*x`;
    const d = extractDropSources(wt, "Arcane Sculptor");
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ kind: "vendor", links: ["Hunhow", "Pontis Tower"], text: "Can be bought from Hunhow at Pontis Tower for 10 Emerald Talent." });
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

describe("extractAbilityLists", () => {
  const sculptor = `==Notes==
*Some note about efficiency.
===Valid Objects===
{| class="wikitable sortable stickyHeader"
|-
! Warframe
! Ability
! [[Helminth#Ability_Replacement|Subsumable]]
!Notes
|-
| rowspan=1 | {{WF|Atlas}}
| {{A|Tectonics}}
| style="text-align:center" |
|
|-
| rowspan=1 |{{WF|Citrine}}
| {{A|Prismatic Gem}}
| style="text-align:center" |
|Doesn't work with {{M|Prismatic Companion}}.
|-
| rowspan=2 | {{WF|Follie}}
| {{A|Shadowgraph}}
| style="text-align:center" |
|
|-
| {{A|Self Portrait}}
| style="text-align:center" | [[File:HelminthChrysalis.png|24px]] Subsumable
|
|-
| rowspan=1 |{{WF|Ivara}}
| {{A|Quiver|Dashwire Arrow}}
| style="text-align:center" |
|
|}
===Invalid Objects===
{|class="wikitable"
|-
! Warframe
! Ability
!Notes
|-
|colspan="2" |[[Exalted Weapon|Exalted Weapons]]
|Including {{WF|Sevagoth}}'s {{A|Exalted Shadow}}
|-
|rowspan="2" |{{WF|Ash}}
|{{A|Shuriken}}
|
|-
|{{A|Blade Storm}}
|Shadows
|}`;
  const lists = extractAbilityLists(sculptor, "Arcane Sculptor", (wf, ab) => (wf === "Ash" && ab === "Shuriken" ? true : undefined));

  it("finds valid and invalid tables from their headings", () => {
    expect(lists.map((l) => [l.kind, l.title, l.abilities.length])).toEqual([["valid", "Valid Objects", 5], ["invalid", "Invalid Objects", 3]]);
    expect(lists[0].intro).toBeNull(); // the line above the table is a heading
  });
  it("carries rowspan'd Warframe cells down and uses display names", () => {
    const a = lists[0].abilities;
    expect(a.map((x) => `${x.name} (${x.warframe})`)).toEqual(["Tectonics (Atlas)", "Prismatic Gem (Citrine)", "Shadowgraph (Follie)", "Self Portrait (Follie)", "Dashwire Arrow (Ivara)"]);
  });
  it("reads the Subsumable column and notes", () => {
    const a = lists[0].abilities;
    expect(a.find((x) => x.name === "Self Portrait")?.helminth).toBe(true);
    expect(a.find((x) => x.name === "Tectonics")?.helminth).toBe(false);
    expect(a.find((x) => x.name === "Prismatic Gem")?.note).toBe("Doesn't work with Prismatic Companion.");
  });
  it("handles colspan special rows and falls back to the Helminth index when there is no column", () => {
    const inv = lists[1].abilities;
    expect(inv[0]).toEqual({ warframe: null, name: "Exalted Weapons", helminth: false, note: "Including Sevagoth's Exalted Shadow" });
    expect(inv.find((x) => x.name === "Shuriken")).toMatchObject({ warframe: "Ash", helminth: true });
    expect(inv.find((x) => x.name === "Blade Storm")).toMatchObject({ warframe: "Ash", helminth: false, note: "Shadows" });
  });
  it("keeps multi-line bullet notes together and takes the intro from the line above the table", () => {
    const wt = `==Eligible Abilities==\n<noinclude>\n*Only the following abilities can trigger this effect:\n</noinclude>\n{| class="wikitable"\n|-\n! Warframe\n! Ability\n! Notes\n|-\n| rowspan=1 | {{WF|Atlas}}\n| {{A|Tectonics}}\n|\n*Does not qualify if {{M|Tectonic Fracture}} is used.\n*Second line.\n|}`;
    const [l] = extractAbilityLists(wt, "Arcane Intention");
    expect(l.intro).toBe("Only the following abilities can trigger this effect:");
    expect(l.abilities[0].note).toBe("Does not qualify if Tectonic Fracture is used. Second line.");
  });
  it("treats \"Helminth-transferable\" in a Notes cell as the Helminth flag and strips it from the note", () => {
    const wt = `==Eligible Abilities==\n{| class="wikitable"\n|-\n! Warframe\n! Ability\n! Notes\n|-\n| rowspan=1 | {{WF|Ivara}}\n| {{A|Quiver}}\n|\n*Only qualifies while its arrows are in flight.\n*Helminth-transferable\n|-\n| rowspan=1 | {{WF|Lavos}}\n| {{A|Vial Rush}}\n|\n*Helminth-transferable\n|}`;
    const [l] = extractAbilityLists(wt, "Arcane Intention");
    expect(l.abilities[0]).toMatchObject({ name: "Quiver", helminth: true, note: "Only qualifies while its arrows are in flight." });
    expect(l.abilities[1]).toMatchObject({ name: "Vial Rush", helminth: true, note: null });
  });
  it("ignores tables without Warframe + Ability columns", () => {
    expect(extractAbilityLists("{| class=\"wikitable\"\n|-\n! Rank\n! Ability Strength\n|-\n| 0 || 10%\n|}", "X")).toEqual([]);
  });
});
