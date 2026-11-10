/**
 * Re-scrapes browse.wf's Riven Calculator (https://browse.wf/rivencalc) into `data/rivencalc.json`, the dataset the
 * app grades rivens with: the full min–max roll range of every stat, for every weapon category and layout (buffs and
 * curses), the grade bands, and which weapon is which category.
 *
 * The calculator computes everything in the browser from the game's export data with RivenParser.js. We download those
 * same files, read them as text/JSON (never executed), confirm the formulas, and tabulate the result — see
 * src/lib/rivencalc/parse.ts. If the source changes shape the script throws instead of guessing.
 *
 *   npm run sync:rivencalc                      # fetch the latest and rewrite data/rivencalc.json (commit the result)
 *   npm run sync:rivencalc -- --check           # fetch + compare, change nothing; exit 1 if the file is out of date
 *   npm run sync:rivencalc -- --dir path        # use saved copies (page.html, RivenParser.js, ExportUpgrades.json,
 *                                               #   ExportWeapons.json, dict.en.json) instead of fetching
 *   npm run sync:rivencalc -- --save-dir path   # also keep the downloaded copies there
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildRivenCalc } from "../src/lib/rivencalc/parse";
import type { RivenCalcData } from "../src/lib/rivencalc/types";

const OUT = "data/rivencalc.json";
const PAGE = "https://browse.wf/rivencalc";
const UA = "RivenBuddy/0.1 (personal tool; rivencalc sync script)";
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function main() {
  const dir = opt("--dir");
  const saveDir = opt("--save-dir");
  let pageHtml: string, parserJs: string, upgradesTxt: string, weaponsTxt: string, dictTxt: string;
  let parserUrl = "", upgradesUrl = "", weaponsUrl = "", dictUrl = "";

  if (dir) {
    console.log(`Reading saved browse.wf files from ${dir} …`);
    const rd = (f: string) => readFileSync(join(dir, f), "utf8");
    pageHtml = rd("page.html"); parserJs = rd("RivenParser.js"); upgradesTxt = rd("ExportUpgrades.json"); weaponsTxt = rd("ExportWeapons.json"); dictTxt = rd("dict.en.json");
  } else {
    console.log(`Reading ${PAGE} …`);
    pageHtml = await get(PAGE);
    const abs = (u: string) => new URL(u, PAGE).toString();
    parserUrl = abs(/<script[^>]+src="([^"]*RivenParser\.js[^"]*)"/.exec(pageHtml)?.[1] ?? (() => { throw new Error("page no longer loads RivenParser.js"); })());
    upgradesUrl = abs(/fetch\("([^"]*ExportUpgrades\.json)"\)/.exec(pageHtml)?.[1] ?? (() => { throw new Error("page no longer loads ExportUpgrades.json"); })());
    weaponsUrl = abs(/fetch\("([^"]*ExportWeapons\.json)"\)/.exec(pageHtml)?.[1] ?? (() => { throw new Error("page no longer loads ExportWeapons.json"); })());
    const common = await get(abs(/<script[^>]+src="(common\.js[^"]*)"/.exec(pageHtml)?.[1] ?? "common.js"));
    const dictBase = /fetch\("([^"]*warframe-public-export-plus\/dict\.)"\s*\+/.exec(common)?.[1];
    if (!dictBase) throw new Error("common.js no longer loads the dictionary from warframe-public-export-plus/dict.<lang>.json");
    dictUrl = `${dictBase}en.json`;
    [parserJs, upgradesTxt, weaponsTxt, dictTxt] = await Promise.all([get(parserUrl), get(upgradesUrl), get(weaponsUrl), get(dictUrl)]);
    if (saveDir) {
      mkdirSync(saveDir, { recursive: true });
      for (const [f, t] of [["page.html", pageHtml], ["RivenParser.js", parserJs], ["ExportUpgrades.json", upgradesTxt], ["ExportWeapons.json", weaponsTxt], ["dict.en.json", dictTxt]] as const) writeFileSync(join(saveDir, f), t);
    }
  }

  const statMap = (JSON.parse(readFileSync("data/rivencalc-stat-map.json", "utf8")) as { stats: Record<string, string | string[]> }).stats;
  const { data, warnings } = buildRivenCalc(
    { pageHtml, parserJs, upgrades: JSON.parse(upgradesTxt), weapons: JSON.parse(weaponsTxt), dict: JSON.parse(dictTxt) },
    {
      url: PAGE, parserUrl, upgradesUrl, weaponsUrl, dictUrl,
      sha256: { page: sha(pageHtml), parser: sha(parserJs), upgrades: sha(upgradesTxt), weapons: sha(weaponsTxt), dict: sha(dictTxt) },
      fetchedAt: new Date().toISOString(),
    },
    statMap,
  );

  const cells = Object.values(data.ranges).reduce((n, c) => n + Object.values(c).reduce((m, l) => m + Object.keys(l.buffs).length + Object.keys(l.curses).length, 0), 0);
  console.log(`  RivenParser.js sha256 ${data.source.sha256.parser.slice(0, 12)} · page ${data.source.sha256.page.slice(0, 12)}`);
  console.log(`  confirmed: roll ×${data.roll.min}–×${data.roll.max} · disposition ${data.disposition} (locked) · rank ${data.rank} · curses graded ${data.curseGrading}`);
  console.log(`  ${data.categories.length} categories (${data.categories.map((c) => c.name).join(", ")}) × ${data.layouts.length} layouts (${data.layouts.map((l) => l.id).join(", ")})`);
  console.log(`  ${data.stats.length} stats · ${cells} stat ranges tabulated · ${data.weapons.length} weapons`);
  console.log(`  grade bands: ${[...data.gradeBands].reverse().map((b) => b.grade).join(" > ")} (impossible beyond ±${data.outOfRangeDeviation}%)`);
  for (const w of warnings) console.warn(`  ! ${w}`);

  const wfmPath = "data/generated/riven_attributes.json";
  if (existsSync(wfmPath)) {
    const wfm = (JSON.parse(readFileSync(wfmPath, "utf8")) as { slug: string }[]).map((a) => a.slug);
    const unmapped = wfm.filter((s) => !data.statSlugs[s]);
    if (unmapped.length) console.warn(`  note: Warframe Market riven stats the calculator doesn't list (they show as ungraded): ${unmapped.join(", ")}`);
  }

  // Keep fetchedAt unless something real changed, so re-running on an unchanged source leaves no diff.
  const prev = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, "utf8")) as RivenCalcData) : null;
  const same = prev && serialize({ ...data, source: { ...data.source, fetchedAt: prev.source.fetchedAt } }) === serialize(prev);
  if (flag("--check")) {
    console.log(same ? `${OUT} is up to date.` : `${OUT} is OUT OF DATE with browse.wf — run npm run sync:rivencalc and commit the result.`);
    process.exit(same ? 0 : 1);
  }
  if (same) return void console.log(`${OUT} already matches browse.wf — nothing to write.`);
  writeFileSync(OUT, serialize(data));
  console.log(`wrote ${OUT}${prev ? " (source changed since the last sync)" : ""}`);
}

/** One line per top-level field and per category/layout, so a changed range shows up as a small diff. */
function serialize(d: RivenCalcData): string {
  const lines = Object.entries(d).map(([k, v]) => {
    if (k !== "ranges") return `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`;
    const cats = Object.entries(d.ranges).map(([c, layouts]) => `    ${JSON.stringify(c)}: {\n${Object.entries(layouts).map(([l, r]) => `      ${JSON.stringify(l)}: ${JSON.stringify(r)}`).join(",\n")}\n    }`);
    return `  "ranges": {\n${cats.join(",\n")}\n  }`;
  });
  return `{\n${lines.join(",\n")}\n}\n`;
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
