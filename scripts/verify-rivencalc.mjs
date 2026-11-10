/**
 * Independent check of data/rivencalc.json: drives the REAL https://browse.wf/rivencalc page in headless Chromium,
 * reads the min–max it shows for every stat in every category × layout, and compares it with the stored data.
 * (Display rounding only: the page rounds to 0.1, so a difference of exactly 0.1 at a rounding tie is accepted.)
 *
 *   npm run verify:rivencalc        # needs Playwright with Chromium installed (not a project dependency)
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { console.error("Playwright isn't installed here (npm i -D playwright && npx playwright install chromium)."); process.exit(2); }

const data = JSON.parse(readFileSync("data/rivencalc.json", "utf8"));
const upgrades = await (await fetch(data.source.upgradesUrl)).json();
const PRE = "/Lotus/Upgrades/Mods/Randomized/";
// The page's own display rounding (valueToDisplayValue): ×100 for everything except factions and three 1-decimal stats.
// (That includes Punch Through, which the page therefore shows 100× larger than the in-game number; we store the in-game value.)
const siteDisp = (tag, raw) => /FactionDamage/.test(tag) ? Math.round(raw * 100) / 100
  : ["WeaponMeleeComboInitialBonusMod", "ComboDurationMod", "WeaponMeleeRangeIncMod"].includes(tag) ? Math.round(raw * 10) / 10
  : Math.round(raw * 1000) / 10;
const unitOf = Object.fromEntries(data.stats.map((s) => [s.tag, s.unit]));
const rawOf = (tag, app) => unitOf[tag] === "percent" ? app / 100 : unitOf[tag] === "multiply" ? app - 1 : app;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(data.source.url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForFunction(() => window.RivenParser && window.ExportUpgrades && document.getElementById("buffs-body").children.length > 0, null, { timeout: 60000 });

let checked = 0;
const bad = [];
for (const cat of data.categories) for (const lay of data.layouts) {
  const dom = await page.evaluate(({ cat, lay, disp }) => {
    document.getElementById("riven-type").value = cat;
    document.getElementById("omega-attenuation").value = String(disp);
    document.getElementById("lvl").value = 8;
    document.getElementById("buffs").value = lay.buffs;
    document.getElementById("curses").value = lay.curses;
    weaponConfig = `${cat}:${disp}`; calculateStats();
    const grab = (id) => [...document.getElementById(id).children].map((d) => [...d.querySelectorAll("b")].map((b) => Number(b.textContent)));
    return { buffs: grab("buffs-body"), curses: grab("curses-body") };
  }, { cat: cat.id, lay, disp: data.disposition });
  const entries = upgrades[PRE + cat.id].upgradeEntries;
  const mine = data.ranges[cat.id][lay.id];
  const tables = [["buffs", entries.filter((e) => e.prefixTag).map((e) => e.tag), dom.buffs],
    ["curses", lay.curses ? entries.filter((e) => e.tag !== "WeaponMeleeComboBonusOnHitMod").map((e) => e.tag) : [], lay.curses ? dom.curses : []]];
  for (const [kind, tags, rows] of tables) {
    if (tags.length !== rows.length) { bad.push(`${cat.id} ${lay.id} ${kind}: ${tags.length} stats stored vs ${rows.length} on the page`); continue; }
    tags.forEach((tag, i) => {
      const stored = mine[kind][tag].map((v) => siteDisp(tag, rawOf(tag, v)));
      const diff = Math.max(Math.abs(stored[0] - rows[i][0]), Math.abs(stored[1] - rows[i][1]));
      checked++;
      if (diff > 0.1000001) bad.push(`${cat.id} ${lay.id} ${kind} ${tag}: stored ${stored.join("..")} vs page ${rows[i].join("..")}`);
    });
  }
}
await browser.close();
console.log(`checked ${checked} stat ranges against the live page; ${bad.length} mismatches`);
for (const b of bad.slice(0, 30)) console.log("  " + b);
process.exit(bad.length ? 1 : 0);
