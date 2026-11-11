import { describe, expect, it } from "vitest";
import { normalizeWorldState } from "./worldstate";
import { WORLD_STATE_FIXTURE } from "./worldstate.fixture";

// "now" shortly after the fixture was captured, so its timers are still in the future
const NOW = Date.parse("2026-11-11T17:50:00Z");
const ws = normalizeWorldState(WORLD_STATE_FIXTURE, NOW);

describe("normalizeWorldState (real feed)", () => {
  it("reads the open-world cycles", () => {
    const by = (id: string) => ws.cycles.find((c) => c.id === id)!;
    expect(by("cetus")).toMatchObject({ name: "Plains of Eidolon", state: "night" });
    expect(by("vallis").state).toBe("cold");
    expect(by("cambion").state).toBe("vome");
    expect(by("zariman").state).toBe("Grineer-held");
    expect(by("duviri").state).toBe("envy");
  });
  it("keeps a cycle whose timer has just run out instead of hiding it", () => {
    const later = normalizeWorldState(WORLD_STATE_FIXTURE, Date.parse("2026-11-12T00:00:00Z"));
    expect(later.cycles.map((c) => c.id)).toEqual(expect.arrayContaining(["cetus", "vallis", "cambion", "earth", "zariman", "duviri"]));
  });
  it("Duviri's Circuit choices", () => expect(ws.duviri?.choices.map((c) => c.category)).toEqual(["normal", "hard"]));
  it("fissures: planet, tier order, Steel Path and storm flags", () => {
    expect(ws.fissures.length).toBeGreaterThan(0);
    expect(ws.fissures[0].tierNum).toBeLessThanOrEqual(ws.fissures[ws.fissures.length - 1].tierNum);
    const f = ws.fissures.find((x) => x.node.includes("(")) ?? ws.fissures[0];
    expect(f.planet).toBe(/\((.+)\)/.exec(f.node)?.[1]);
    expect(ws.fissures.some((x) => x.steelPath)).toBe(true);
  });
  it("drops anything already expired", () => expect(normalizeWorldState(WORLD_STATE_FIXTURE, Date.parse("2030-01-01T00:00:00Z")).fissures).toEqual([]));
  it("Baro: where and when (inventory is empty until he arrives)", () => {
    expect(ws.baro).toMatchObject({ location: "Orcus Relay (Pluto)", items: [] });
    expect(Date.parse(ws.baro!.arrives)).toBeGreaterThan(NOW);
  });
  it("sortie, archon hunt and Teshin's rotation", () => {
    expect(ws.sortie!.missions).toHaveLength(3);
    expect(ws.sortie!.missions[0]).toMatchObject({ type: "Rescue", node: "Roche (Phobos)" });
    expect(ws.archon!.missions[0].type).toBe("Extermination");
    expect(ws.teshin).toMatchObject({ current: { name: "Umbra Forma Blueprint", cost: 150 } });
    expect(ws.teshin!.rotation.length).toBeGreaterThan(3);
  });
  it("invasions show both sides' rewards and progress", () => {
    const i = ws.invasions[0];
    expect(i.attacker.reward).toContain("Dera Vandal Stock");
    expect(i.completion).toBeGreaterThan(0);
  });
  it("Darvo's deal and the Nightwave challenges", () => {
    expect(ws.darvo).toMatchObject({ item: "Furax", originalPrice: 125, salePrice: 112 });
    expect(ws.nightwave!.challenges[0]).toMatchObject({ title: "Glider", daily: true });
  });
  it("copes with a feed that is missing pieces", () => {
    const empty = normalizeWorldState({}, NOW);
    expect(empty).toMatchObject({ cycles: [], fissures: [], baro: null, sortie: null, archon: null, teshin: null, invasions: [], darvo: null, nightwave: null });
  });
});
