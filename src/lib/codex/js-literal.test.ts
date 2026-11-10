import { describe, expect, it } from "vitest";
import { balancedLiteral, parseJsLiteral } from "./js-literal";

describe("parseJsLiteral", () => {
  it("parses the shapes the Codex tables use", () => {
    expect(parseJsLiteral("[['Damage vs Corpus',.45,.45,null,'x'],['Crit',149.99,90,null,'%']]")).toEqual([["Damage vs Corpus", 0.45, 0.45, null, "x"], ["Crit", 149.99, 90, null, "%"]]);
    expect(parseJsLiteral("[{id:'2/1',p:2,n:1,b:1.2375,m:-.495},]")).toEqual([{ id: "2/1", p: 2, n: 1, b: 1.2375, m: -0.495 }]);
  });
  it("handles quotes, escapes, comments and booleans", () => {
    expect(parseJsLiteral(`["it\\'s", 'a "b"', true, false, /* c */ 1e2] // end`)).toEqual(["it's", 'a "b"', true, false, 100]);
  });
  it("refuses anything that isn't a literal (no code execution path)", () => {
    expect(() => parseJsLiteral("[alert(1)]")).toThrow(/unsupported/);
    expect(() => parseJsLiteral("[1+2]")).toThrow();
    expect(() => parseJsLiteral("{a: window}")).toThrow(/unsupported/);
    expect(() => parseJsLiteral("[1,")).toThrow();
  });
});

describe("balancedLiteral", () => {
  it("extracts a nested literal, ignoring brackets inside strings", () => {
    const src = `const S=[['a]',1],['b',[2,3]]]; const X=1;`;
    expect(balancedLiteral(src, src.indexOf("["))).toBe("[['a]',1],['b',[2,3]]]");
  });
  it("throws when unbalanced", () => expect(() => balancedLiteral("[[1,2]", 0)).toThrow());
});
