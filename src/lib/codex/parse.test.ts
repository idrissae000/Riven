import { describe, expect, it } from "vitest";
import { parseCodexRiven } from "./parse";

// A miniature page with the same code shapes as the real calculator.
const PAGE = `<meta name="riven-version" content="9.9.9">
<script>
const W=['Rifle','Pistol'];
// name, rifle, pistol, unit
const S=[
['Critical Chance',149.99,149.99,'%'],
['Damage vs Corpus',.45,null,'x'],
['Weapon Recoil',90,90,'%']];
const C=[{id:'2/0',p:2,n:0,b:.99,m:0},{id:'2/1',p:2,n:1,b:1.2375,m:-.495}];
S.forEach(r=>{for(let j=1;j<=2;j++)if(r[j]!==null)r[j]=+(r[j]*1.2).toFixed(4)});
function buildResultEntry(v,k,cfg){
  const neg=k>=cfg.p,s=S[v],base=s[st.w+1],u=s[2],fl=s[0]==='Weapon Recoil'?-1:1;
  const e=base*(neg?st.d*cfg.m:st.d*cfg.b)*fl,lo=e*.9,hi=e*1.1;
}
const RIVEN_GRADE_BANDS=[
  ['F',-10,-5],['B',-5,5],['S',5,10]
];
const NONEG=new Set(['Damage vs Corpus']);
const WP=[["Soma",0,1.2],["Lex",1,1.2],["Daikyu",0,1.2,1]];
</script>`;
const MAP = { critical_chance: "Critical Chance", recoil: "Weapon Recoil" };
const meta = { url: "u", repo: "r", fetchedAt: "2026-01-01T00:00:00Z" };

describe("parseCodexRiven", () => {
  const d = parseCodexRiven(PAGE, meta, MAP);

  it("reads every table from the page's own code", () => {
    expect(d.source.version).toBe("9.9.9");
    expect(d.categories).toEqual(["Rifle", "Pistol"]);
    expect(d.stats).toEqual([
      { name: "Critical Chance", unit: "%", base: [149.99, 149.99] },
      { name: "Damage vs Corpus", unit: "x", base: [0.45, null] },
      { name: "Weapon Recoil", unit: "%", base: [90, 90] },
    ]);
    expect(d.layouts[1]).toEqual({ id: "2/1", positives: 2, negatives: 1, positiveMultiplier: 1.2375, negativeMultiplier: -0.495 });
    expect(d.noNegative).toEqual(["Damage vs Corpus"]);
    expect(d.weapons).toEqual([{ name: "Soma", category: 0 }, { name: "Lex", category: 1 }, { name: "Daikyu", category: 0, bow: true }]);
  });
  it("CONFIRMS (not assumes) the roll range, disposition factor and inverted stats from the code", () => {
    expect(d.roll).toEqual({ min: 0.9, max: 1.1 });
    expect(d.disposition).toEqual({ factor: 1.2, decimals: 4 });
    expect(d.invertedStats).toEqual(["Weapon Recoil"]);
  });
  it("follows a changed roll range", () => {
    const wider = parseCodexRiven(PAGE.replace("lo=e*.9,hi=e*1.1", "lo=e*.8,hi=e*1.2").replace("['F',-10,-5],['B',-5,5],['S',5,10]", "['F',-20,-5],['B',-5,5],['S',5,20]"), meta, MAP);
    expect(wider.roll).toEqual({ min: 0.8, max: 1.2 });
  });
  it("fingerprints the source", () => expect(d.source.sha256).toMatch(/^[0-9a-f]{64}$/));

  describe("fails loudly when the source changes", () => {
    const bad = (mutate: (p: string) => string) => () => parseCodexRiven(mutate(PAGE), meta, MAP);
    it("missing roll formula", () => expect(bad((p) => p.replace("lo=e*.9,hi=e*1.1", "lo=e,hi=e"))).toThrow(/roll range/));
    it("center formula no longer base × multiplier", () => expect(bad((p) => p.replace("e=base*(neg?st.d*cfg.m:st.d*cfg.b)*fl", "e=base*fl"))).toThrow(/center-value formula/));
    it("missing layout table", () => expect(bad((p) => p.replace("const C=", "const Cx="))).toThrow(/layout table/));
    it("bands that don't span the roll range", () => expect(bad((p) => p.replace("['S',5,10]", "['S',5,9]"))).toThrow(/don't span/));
    it("non-contiguous bands", () => expect(bad((p) => p.replace("['B',-5,5]", "['B',-4,5]"))).toThrow(/contiguous/));
    it("a table row with the wrong width", () => expect(bad((p) => p.replace("['Weapon Recoil',90,90,'%']", "['Weapon Recoil',90,'%']"))).toThrow(/unexpected base-table row/));
    it("a stat map pointing at a stat the Codex lacks", () =>
      expect(() => parseCodexRiven(PAGE, meta, { ...MAP, zoom: "Zoomies" })).toThrow(/doesn't have/));
  });
});
