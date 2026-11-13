import { describe, expect, it } from "vitest";
import { browseRows } from "./browse";

const r = (name: string, qty: number, unit: number | null) => ({ name, qty, unit, total: unit == null ? null : unit * qty });
const rows = [r("Lex Prime Barrel", 3, 5), r("Frost Prime Chassis Blueprint", 1, 40), r("Akbolto Prime Link", 10, null), r("Lex Prime Receiver", 2, 12)];
const names = (x: { name: string }[]) => x.map((i) => i.name);

describe("browseRows", () => {
  it("sorts by price each with unpriced last, by stack value, A–Z, Z–A and quantity", () => {
    expect(names(browseRows(rows, "", "price"))).toEqual(["Frost Prime Chassis Blueprint", "Lex Prime Receiver", "Lex Prime Barrel", "Akbolto Prime Link"]);
    expect(names(browseRows(rows, "", "total"))[0]).toBe("Frost Prime Chassis Blueprint");
    expect(names(browseRows(rows, "", "az"))[0]).toBe("Akbolto Prime Link");
    expect(names(browseRows(rows, "", "za"))[0]).toBe("Lex Prime Receiver");
    expect(names(browseRows(rows, "", "qty"))[0]).toBe("Akbolto Prime Link");
  });
  it("searches by words in any order, ignoring case", () => {
    expect(names(browseRows(rows, "BARREL lex", "az"))).toEqual(["Lex Prime Barrel"]);
    expect(names(browseRows(rows, "prime", "az"))).toHaveLength(4);
    expect(browseRows(rows, "zzz", "az")).toEqual([]);
  });
});
