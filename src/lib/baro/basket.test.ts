import { describe, expect, it } from "vitest";
import { bestBasket } from "./basket";

const I = (name: string, ducats: number, credits: number, value: number) => ({ name, ducats, credits, value });
const stock = [I("Flow", 350, 110_000, 50), I("Steady Hands", 300, 220_000, 62), I("Cracker", 400, 150_000, 48), I("Skin", 100, 50_000, 0)];

describe("bestBasket", () => {
  it("picks the most platinum that fits both budgets", () => {
    const b = bestBasket(stock, { ducats: 700, credits: 400_000 });
    expect(b.items.map((i) => i.name).sort()).toEqual(["Flow", "Steady Hands"]); // 112p for 650 ducats; Flow+Cracker is 98p
    expect(b).toMatchObject({ ducats: 650, credits: 330_000, value: 112 });
  });
  it("the credits limit can be the binding one", () => {
    expect(bestBasket(stock, { ducats: 5000, credits: 260_000 }).items.map((i) => i.name).sort()).toEqual(["Cracker", "Flow"]);
    expect(bestBasket(stock, { ducats: 5000, credits: 250_000 }).items.map((i) => i.name)).toEqual(["Steady Hands"]); // the pair would cost 260k
  });
  it("no limit takes everything worth something; nothing fits gives an empty basket", () => {
    expect(bestBasket(stock, { ducats: null, credits: null }).items).toHaveLength(3); // the 0p skin is skipped
    expect(bestBasket(stock, { ducats: 100, credits: null }).items).toEqual([]);
  });
});
