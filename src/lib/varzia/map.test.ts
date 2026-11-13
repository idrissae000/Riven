import { describe, expect, it } from "vitest";
import { setNameFor } from "./map";

describe("setNameFor", () => {
  it("maps warframes and weapons to their Prime set", () => {
    expect(setNameFor("Saryn Prime")).toBe("Saryn Prime Set");
    expect(setNameFor("Infestation Prime")).toBe("Nidus Prime Set");
    expect(setNameFor("Prime Strun Weapon")).toBe("Strun Prime Set");
    expect(setNameFor("Prime Nikana")).toBe("Nikana Prime Set");
  });
  it("leaves cosmetics, packs, scenes and relics alone", () => {
    for (const n of ["Nidus Prime Scene", "Nidus Prime Syandana", "M P V Saryn Prime Single Pack", "Prime Scarf D Item", "Prime Access Sigil Saryn", "Saryn Prime Bobble Head", "Infestation Prime Ship Maggot", "T1 Void Projection Nidus Saryn Vault A Bronze", "Infested Necra Mech Skin"]) expect(setNameFor(n)).toBeNull();
  });
});
