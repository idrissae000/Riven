import { describe, expect, it } from "vitest";
import { parseRelicPack, relicPool, valuePool } from "./relics";
import type { PrimePart, Relic } from "@/lib/primes/types";

const part = (slug: string, name: string): PrimePart => ({ slug, name, kind: "part", type: "other", ducats: null, setSlug: null, perSet: 1, relics: [], vaulted: true });
const parts = [part("nidus_prime_systems", "Nidus Prime Systems Blueprint"), part("saryn_prime_chassis", "Saryn Prime Chassis Blueprint"), part("ash_prime_systems", "Ash Prime Systems Blueprint")];
const relic = (name: string, era: Relic["era"], c: (string | null)[], u: (string | null)[], rare: string | null): Relic => ({ id: name.toLowerCase().replace(" ", "_"), era, name, vaulted: true, common: c, uncommon: u, rare });
const relics = [
  relic("Meso N1", era("Meso"), ["nidus_prime_systems", null, null], ["ash_prime_systems", null], "ash_prime_systems"),
  relic("Meso S1", era("Meso"), ["ash_prime_systems", null, null], ["saryn_prime_chassis", null], "ash_prime_systems"),
  relic("Meso X1", era("Meso"), ["ash_prime_systems", null, null], [null, null], "ash_prime_systems"),
  relic("Lith N1", era("Lith"), ["nidus_prime_systems", null, null], [null, null], null),
];
function era(e: Relic["era"]) { return e; }

describe("parseRelicPack", () => {
  it("reads the era, frames, vault and refinement", () => {
    expect(parseRelicPack("T2 Void Projection Nidus Saryn Vault B Bronze")).toEqual({ tier: 2, era: "Meso", frames: ["Nidus", "Saryn"], vault: "B", colour: "Bronze", refinement: "intact" });
    expect(parseRelicPack("T4 Void Projection Nidus Saryn Vault A Gold")?.era).toBe("Axi");
  });
  it("ignores everything else", () => {
    expect(parseRelicPack("Saryn Prime")).toBeNull();
    expect(parseRelicPack("M P V Nidus Prime Single Pack")).toBeNull();
  });
});
describe("relicPool + valuePool", () => {
  it("keeps the era's relics that drop those frames' parts, and values them", () => {
    const pool = relicPool(relics, parts, "Meso", ["Nidus", "Saryn"]);
    expect(pool.map((r) => r.name)).toEqual(["Meso N1", "Meso S1"]);
    const v = valuePool(pool, parts, "intact", (s) => (s === "nidus_prime_systems" ? 30 : s === "saryn_prime_chassis" ? 20 : 10));
    expect(v.relics[0].name).toBe("Meso N1");
    expect(v.avg).toBeGreaterThan(0);
    expect(v.relics[0].best).toEqual({ name: "Nidus Prime Systems Blueprint", price: 30 });
  });
});
