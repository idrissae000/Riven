import { describe, expect, it } from "vitest";
import { rankMissions, valueRelic, type RewardData } from "./value";

const price = (n: string) => ({ "Ash Prime Systems": 40, "Ash Prime Blueprint": 10 } as Record<string, number>)[n] ?? null;

describe("valueRelic", () => {
  it("weights each reward by its chance, skips Forma, and flags unpriced parts", () => {
    expect(valueRelic([{ n: "Ash Prime Systems", c: 50 }, { n: "Ash Prime Blueprint", c: 50 }], price)).toEqual({ ev: 25, gap: false });
    expect(valueRelic([{ n: "Forma Blueprint", c: 50 }, { n: "Ash Prime Systems", c: 50 }], price)).toEqual({ ev: 20, gap: false });
    expect(valueRelic([{ n: "Mystery Prime Part", c: 50 }, { n: "Ash Prime Systems", c: 50 }], price)).toEqual({ ev: 20, gap: true });
  });
});

describe("rankMissions", () => {
  const data: RewardData = {
    fetchedAt: "x",
    relics: { "Lith A1": { intact: [{ n: "Ash Prime Systems", c: 100 }], radiant: [{ n: "Ash Prime Systems", c: 100 }] } },
    nodes: [
      { planet: "Mercury", node: "Apollodorus", mode: "Survival", tables: { A: { total: 100, items: [] }, B: { total: 100, items: [{ n: "Lith A1 Relic", c: 10 }] }, C: { total: 100, items: [{ n: "Lith A1 Relic", c: 25 }, { n: "Arcane Tempo", c: 5 }] } } },
      { planet: "Venus", node: "Aphrodite", mode: "Exterminate", tables: { A: { total: 100, items: [{ n: "Lith A1 Relic", c: 20 }] } } },
    ],
  };
  it("values rotations, an endless cycle (A, A, B, C) and single runs", () => {
    const rows = rankMissions(data, price, (n) => (n === "Arcane Tempo" ? 100 : null));
    expect(rows[0].rotations).toEqual({ A: 0, B: 4, C: 15 }); // C: 0.25×40 + 0.05×100
    expect(rows[0].cycle).toBe(19);
    expect(rows[0].run).toBeNull();
    expect(rows[0].pricedShare).toBe(13); // (10+25+5)/300
    expect(rows[0].top).toEqual([{ name: "Lith A1 Relic", plat: 14 }, { name: "Arcane Tempo", plat: 5 }]);
    expect(rows[1]).toMatchObject({ cycle: null, run: 8 });
  });
  it("counts an arcane without a price as a gap", () => {
    expect(rankMissions(data, price, () => null)[0].gaps).toBe(1);
  });
});
