import { describe, expect, it } from "vitest";
import { combineSets, type CombinableRow, type SetDef } from "./combine-sets";

const row = (slug: string, qty: number, unit: number | null): CombinableRow => ({ key: `prime:${slug}:0`, kind: "prime", slug, rank: 0, name: slug, qty, unit, ducats: null });
const make = (s: SetDef, copies: number, unit: number): CombinableRow => ({ key: `prime:${s.slug}:0`, kind: "prime", slug: s.slug, rank: 0, name: s.name, qty: copies, unit, ducats: null });
const X: SetDef = { slug: "x_prime_set", name: "X Prime Set", parts: [{ slug: "x_barrel", perSet: 2 }, { slug: "x_stock", perSet: 1 }] };

describe("combineSets", () => {
  it("lists the set instead of its parts when the set sells for more, keeping spares", () => {
    const rows = [row("x_barrel", 5, 20), row("x_stock", 2, 30), row("y_other", 1, 4)];
    const c = combineSets(rows, [X], () => 100, make); // parts: 2×20 + 30 = 70 < 100
    expect(c.sets).toEqual([{ slug: "x_prime_set", name: "X Prime Set", copies: 2, gain: 60 }]);
    expect(c.rows.map((r) => [r.slug, r.qty])).toEqual([["x_prime_set", 2], ["x_barrel", 1], ["y_other", 1]]); // 5 barrels − 4 used = 1 spare; stocks all used
  });
  it("leaves things alone when the parts are worth more, a part is missing, or a price is unknown", () => {
    const full = [row("x_barrel", 2, 20), row("x_stock", 1, 30)];
    expect(combineSets(full, [X], () => 60, make).sets).toEqual([]); // set 60 < parts 70
    expect(combineSets([row("x_barrel", 1, 20), row("x_stock", 1, 30)], [X], () => 100, make).sets).toEqual([]); // only 1 of 2 barrels
    expect(combineSets([row("x_barrel", 2, 20), row("x_stock", 1, null)], [X], () => 100, make).sets).toEqual([]);
    expect(combineSets(full, [X], () => null, make).sets).toEqual([]);
  });
});
