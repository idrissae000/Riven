import { balancedLiteral, parseJsLiteral, type JsValue } from "./js-literal";
import type { GradeBand, LayoutRanges, RivenCalcData, StatDef } from "./types";

/**
 * Builds the riven grading dataset from browse.wf's Riven Calculator (https://browse.wf/rivencalc).
 *
 * The page does its maths with `RivenParser.js` over the game's export data (`ExportUpgrades.json`,
 * `ExportWeapons.json`, `dict.en.json`). We read all of that as TEXT / JSON — never executing any of it — confirm that
 * the formulas still read the way this file implements them (and throw if they don't), then tabulate the page's own
 * calculation for every weapon category × layout × stat. Nothing is typed in by hand except the Warframe Market
 * slug → stat tag map and the list of layouts to tabulate.
 */

const MOD_PREFIX = "/Lotus/Upgrades/Mods/Randomized/";
/** The layouts tabulated: the four real riven layouts plus 1 buff + 1 curse, which the page also accepts. */
export const LAYOUTS: { id: string; buffs: number; curses: number }[] = [
  { id: "2/0", buffs: 2, curses: 0 }, { id: "2/1", buffs: 2, curses: 1 },
  { id: "3/0", buffs: 3, curses: 0 }, { id: "3/1", buffs: 3, curses: 1 },
  { id: "1/1", buffs: 1, curses: 1 },
];
/** The calculator is used at this disposition on purpose — it is not varied. */
export const LOCKED_DISPOSITION = 1.2;

export interface RivenCalcSources {
  pageHtml: string;
  parserJs: string;
  upgrades: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  weapons: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  dict: Record<string, string>;
}
export type RivenCalcMeta = Pick<RivenCalcData["source"], "url" | "parserUrl" | "upgradesUrl" | "weaponsUrl" | "dictUrl" | "sha256" | "fetchedAt">;

const squash = (s: string) => s.replace(/\s+/g, " ");
const num = (v: number) => Number(v.toPrecision(10));

function expect(haystack: string, needle: string, what: string) {
  if (!squash(haystack).includes(squash(needle))) throw new Error(`browse.wf source changed: could not confirm ${what} (expected \`${needle}\`). Review RivenParser.js / the page before re-syncing.`);
}

function literalAfter(src: string, marker: string): JsValue {
  const at = src.indexOf(marker);
  if (at < 0) throw new Error(`browse.wf source changed: \`${marker}\` not found`);
  const open = src.slice(at + marker.length).search(/[[{]/) + at + marker.length;
  return parseJsLiteral(balancedLiteral(src, open));
}

function cleanName(loc: string): string {
  return loc.replace(/^\|(?:val|STAT1)\|(?:%|s)?\s*/, "").replace(/<[^>]+>/g, "").trim();
}

function unitFor(tag: string, loc: string): StatDef["unit"] {
  if (/FactionDamage/.test(tag)) return "multiply";
  if (/^\|(?:val|STAT1)\|%/.test(loc)) return "percent";
  if (/^\|val\|s\b/.test(loc)) return "seconds";
  return "";
}

/** Value as a player sees it (percent ×100, "x" stats as 1 + x), from the calculator's raw internal value. */
const appValue = (raw: number, unit: StatDef["unit"]) => num(unit === "percent" ? raw * 100 : unit === "multiply" ? 1 + raw : raw);

export function buildRivenCalc(src: RivenCalcSources, meta: RivenCalcMeta, statSlugs: Record<string, string | string[]>): { data: RivenCalcData; warnings: string[] } {
  const warnings: string[] = [];
  const { pageHtml: page, parserJs: js } = src;

  // ── 1. Confirm the formulas the way RivenParser.js writes them ──────────────────────────────────
  const rivenTags = literalAfter(js, "const riven_tags =") as unknown as Record<string, { tag: string; value: number }[]>;
  const numBuffsAtten = literalAfter(js, "const numBuffsAtten =") as number[];
  const numBuffsCurseAtten = literalAfter(js, "const numBuffsCurseAtten =") as number[];
  const parseFn = js.slice(js.indexOf("function parseRiven("), js.indexOf("function unparseBuff(")).replace(/\/\/[^\n]*/g, ""); // comments dropped
  if (!parseFn) throw new Error("browse.wf source changed: parseRiven() not found");
  expect(parseFn, "const curseAtten = Math.pow(1.25, fingerprint.curses.length);", "the 1.25^curses boost on buffs");
  expect(parseFn, "attenuation *= 1.5; attenuation *= omegaAttenuation; attenuation *= 10;", "attenuation = 1.5 × disposition × 10");
  expect(parseFn, "upgradeValue *= attenuation; upgradeValue *= curseAtten; upgradeValue *= lerp(0.9, 1.1, rivenIntToFloat(buff.Value)); upgradeValue *= numBuffsAtten[Math.min(fingerprint.buffs.length, numBuffsAtten.length - 1)]; upgradeValue *= fingerprint.lvl + 1;", "the buff formula");
  expect(parseFn, "find(x => x.tag == curse.Tag).value * -1.0; upgradeValue *= attenuation; upgradeValue *= lerp(0.9, 1.1, rivenIntToFloat(curse.Value)); upgradeValue *= numBuffsCurseAtten[Math.min(fingerprint.buffs.length, numBuffsCurseAtten.length - 1)]; upgradeValue *= numBuffsAtten[Math.min(fingerprint.curses.length, numBuffsAtten.length - 1)]; upgradeValue *= fingerprint.lvl + 1;", "the curse formula");
  const rollM = /lerp\((0?\.\d+|\d+(?:\.\d+)?), (\d+(?:\.\d+)?), rivenIntToFloat\(buff\.Value\)\)/.exec(parseFn);
  if (!rollM) throw new Error("browse.wf source changed: roll range not found");
  const roll = { min: Number(rollM[1]), max: Number(rollM[2]) };
  if (roll.min !== 0.9 || roll.max !== 1.1) throw new Error(`browse.wf roll range is ×${roll.min}–×${roll.max}, not the ±10% this app assumes`);

  // Grades: floatToGrade(f) over lerp(-10, +10, f)
  const gradeFn = js.slice(js.indexOf("function floatToGrade("), js.indexOf("const RivenParser"));
  expect(gradeFn, "value = lerp(-10, +10, value);", "grades measured as -10…+10 around the center");
  const oor = /value >= -(\d+(?:\.\d+)?) && value <= \+(\d+(?:\.\d+)?)/.exec(gradeFn);
  if (!oor || oor[1] !== oor[2]) throw new Error("browse.wf source changed: out-of-range check not found");
  const cuts = [...gradeFn.matchAll(/if \(value >= ([+-]?\d+(?:\.\d+)?)\) return "([^"]+)";/g)].map((m) => ({ at: Number(m[1]), grade: m[2] }));
  const lastGrade = /return "([^"]+)";\s*}\s*return "X";/.exec(gradeFn)?.[1];
  if (cuts.length < 5 || !lastGrade) throw new Error("browse.wf source changed: grade table not found");
  const gradeBands: GradeBand[] = [];
  let upper = 10;
  for (const c of cuts) { gradeBands.unshift({ grade: c.grade, lower: c.at, upper }); upper = c.at; }
  gradeBands.unshift({ grade: lastGrade, lower: -10, upper });

  // ── 2. Confirm the page's own behaviour ─────────────────────────────────────────────────────────
  if (!/between 0\.9x and 1\.1x/.test(page)) throw new Error("browse.wf source changed: the ±10% explanation text is gone");
  const omegaOpts = [...(/<select[^>]*id="omega-attenuation"[\s\S]*?<\/select>/.exec(page)?.[0] ?? "").matchAll(/<option value="([\d.]+)"/g)].map((m) => Number(m[1]));
  if (!omegaOpts.includes(LOCKED_DISPOSITION)) throw new Error(`browse.wf no longer offers disposition ${LOCKED_DISPOSITION}`);
  const rank = Number(/id="lvl"[^>]*max="(\d+)"/.exec(page)?.[1]);
  if (!Number.isFinite(rank) || rank < 1) throw new Error("browse.wf source changed: max level not found");
  const categories = [...(/<select[^>]*id="riven-type"[\s\S]*?<\/select>/.exec(page)?.[0] ?? "").matchAll(/<option value="(\w+)"[^>]*>([^<]+)<\/option>/g)].map((m) => ({ id: m[1], name: m[2].trim() }));
  if (categories.length < 5) throw new Error("browse.wf source changed: weapon-type dropdown not found");
  expect(page, 'if (upgrade.prefixTag != "") // Can be buff?', "buffs listed when a stat has a prefix");
  const noCurse = /if \(upgrade\.tag != "(\w+)"\) \/\/ Can be curse\?/.exec(page)?.[1];
  if (!noCurse) throw new Error("browse.wf source changed: curse eligibility rule not found");
  expect(page, "if (upgrade.upgradeValues[0].reverseValueSymbol) { min.displayValue *= -1; max.displayValue *= -1; }", "the reversed-sign curse display");
  // Curses are graded as 1 − f (a milder penalty scores higher); buffs as f.
  const curseGrading: RivenCalcData["curseGrading"] = /unparseCurse\([\s\S]{0,400}?floatToGrade\(1 - f\)/.test(page) ? "inverted" : /unparseCurse\([\s\S]{0,400}?floatToGrade\(f\)/.test(page) ? "same" : (() => { throw new Error("browse.wf source changed: curse grading not found"); })();
  if (!/unparseBuff\([\s\S]{0,400}?floatToGrade\(f\)/.test(page)) throw new Error("browse.wf source changed: buff grading not found");

  // ── 3. Tabulate ─────────────────────────────────────────────────────────────────────────────────
  const att = 1.5 * LOCKED_DISPOSITION * 10;
  const stats = new Map<string, StatDef>();
  const ranges: RivenCalcData["ranges"] = {};
  for (const cat of categories) {
    const mod = src.upgrades[MOD_PREFIX + cat.id];
    const entries = mod?.upgradeEntries as { tag: string; prefixTag?: string; upgradeValues: { value: number; locTag: string; reverseValueSymbol?: boolean }[] }[] | undefined;
    const table = rivenTags[cat.id];
    if (!entries || !table) throw new Error(`browse.wf data missing for ${cat.id}`);
    ranges[cat.id] = {};
    for (const e of entries) {
      const base = table.find((t) => t.tag === e.tag)?.value;
      if (base == null) throw new Error(`RivenParser.js has no base value for ${cat.id} ${e.tag}`);
      const exported = e.upgradeValues[0].value;
      if (Math.abs(exported - base) > 1e-9) warnings.push(`${cat.id} ${e.tag}: RivenParser.js base ${base} ≠ ExportUpgrades ${exported} (the calculator uses RivenParser.js)`);
      const loc = src.dict[e.upgradeValues[0].locTag] ?? "";
      if (!stats.has(e.tag)) stats.set(e.tag, { tag: e.tag, name: cleanName(loc) || e.tag, unit: unitFor(e.tag, loc) });
    }
    for (const lay of LAYOUTS) {
      const out: LayoutRanges = { buffs: {}, curses: {} };
      const cursesBoost = Math.pow(1.25, lay.curses);
      const bAtten = numBuffsAtten[Math.min(lay.buffs, numBuffsAtten.length - 1)];
      const cAtten = numBuffsCurseAtten[Math.min(lay.buffs, numBuffsCurseAtten.length - 1)] * numBuffsAtten[Math.min(lay.curses, numBuffsAtten.length - 1)];
      for (const e of entries) {
        const base = table.find((t) => t.tag === e.tag)!.value;
        const unit = stats.get(e.tag)!.unit;
        if (e.prefixTag) {
          const centre = base * att * cursesBoost * bAtten * (rank + 1);
          out.buffs[e.tag] = [appValue(centre * roll.min, unit), appValue(centre * roll.max, unit)];
        }
        if (lay.curses > 0 && e.tag !== noCurse) { // like the page, curse tables exist only when the riven has a curse
          const flip = e.upgradeValues[0].reverseValueSymbol ? -1 : 1;
          const centre = -base * att * cAtten * (rank + 1) * flip;
          out.curses[e.tag] = [appValue(centre * roll.min, unit), appValue(centre * roll.max, unit)];
        }
      }
      ranges[cat.id][lay.id] = out;
    }
  }

  // ── 4. Which weapon is which category (the page's own datalist logic) ───────────────────────────
  const ids = categories.map((c) => c.id);
  const compat = new Map(ids.map((id) => [id, new Set<string>(src.upgrades[MOD_PREFIX + id].compatibleItems ?? [])]));
  const typeOf = (path: string): string | undefined => {
    let p: string | undefined = path;
    for (let hops = 0; p && hops < 50; hops++) {
      for (const id of ids) if (compat.get(id)!.has(p)) return id;
      p = src.weapons[p]?.parentName;
    }
    return undefined;
  };
  const kitgun = ids.find((i) => /ModularPistol/.test(i)), zaw = ids.find((i) => /ModularMelee/.test(i));
  if (!kitgun || !zaw) throw new Error("browse.wf source changed: kitgun/zaw categories not found");
  const seen = new Set<string>();
  const weapons: RivenCalcData["weapons"] = [];
  const add = (name: string, category: string | undefined) => {
    if (!category) return;
    const k = `${name}|${category}`;
    if (!seen.has(k)) { seen.add(k); weapons.push({ name, category }); }
  };
  for (const [path, w] of Object.entries<any>(src.weapons)) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const name = (src.dict[w.name] ?? w.name) as string;
    if ("primeOmegaAttenuation" in w) { add(name, kitgun); add(`${name} (Primary)`, kitgun); add(`${name} (Secondary)`, kitgun); }
    else if (w.totalDamage != 0) add(name, typeOf(path));
    else if (w.omegaAttenuation != 1.0 && !w.excludeFromCodex) add(name, zaw);
  }
  weapons.sort((a, b) => a.name.localeCompare(b.name));

  // ── 5. Warframe Market slug → stat tag(s) ───────────────────────────────────────────────────────
  const slugMap: Record<string, string[]> = {};
  for (const [slug, v] of Object.entries(statSlugs)) {
    const tags = Array.isArray(v) ? v : [v];
    for (const t of tags) if (!stats.has(t)) throw new Error(`stat map: ${slug} → ${t} is not a stat on browse.wf (renamed?)`);
    slugMap[slug] = tags;
  }

  const data: RivenCalcData = {
    source: { url: meta.url, parserUrl: meta.parserUrl, upgradesUrl: meta.upgradesUrl, weaponsUrl: meta.weaponsUrl, dictUrl: meta.dictUrl, sha256: meta.sha256, fetchedAt: meta.fetchedAt },
    disposition: LOCKED_DISPOSITION,
    rank,
    roll,
    gradeBands,
    outOfRangeDeviation: Number(oor[1]),
    curseGrading,
    categories,
    layouts: LAYOUTS,
    stats: [...stats.values()],
    ranges,
    weapons,
    statSlugs: slugMap,
  };
  return { data, warnings };
}
