/**
 * Rebuilds data/mission-rewards.json: the rewards of every planet mission (and its rotations) from the community drop-table
 * export (WFCD/warframe-drop-data), keeping the things we can put a price on — relics and arcanes — and the total chance of each
 * table, so the page can say how much of it is priced. Re-run after a game update:
 *
 *   npm run sync:mission-rewards
 */
import { writeFileSync } from "node:fs";

const BASE = "https://raw.githubusercontent.com/WFCD/warframe-drop-data/gh-pages/data";
const URL = `${BASE}/missionRewards.json`;
type Item = { itemName: string; chance: number };
type Node = { gameMode: string; isEvent?: boolean; rewards: Record<string, Item[]> | Item[] };

async function main() {
  const res = await fetch(URL, { headers: { "User-Agent": "WarframeEconomist/0.1 (reward sync script)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${URL}`);
  const all = (await res.json() as { missionRewards: Record<string, Record<string, Node>> }).missionRewards;
  const rel = await fetch(`${BASE}/relics.json`, { headers: { "User-Agent": "WarframeEconomist/0.1 (reward sync script)" } });
  if (!rel.ok) throw new Error(`HTTP ${rel.status} for relics.json`);
  const relicRows = (await rel.json() as { relics: { tier: string; relicName: string; state: string; rewards: Item[] }[] }).relics;
  const out: { planet: string; node: string; mode: string; tables: Record<string, { total: number; items: { n: string; c: number }[] }> }[] = [];
  for (const [planet, nodes] of Object.entries(all)) {
    for (const [node, v] of Object.entries(nodes)) {
      if (v.isEvent || node.includes("(")) continue; // "(Extra)" / "(Caches)" are separate bonus tables, not the mission's own rewards
      const tables = Array.isArray(v.rewards) ? { A: v.rewards } : v.rewards;
      const kept: Record<string, { total: number; items: { n: string; c: number }[] }> = {};
      for (const [rot, items] of Object.entries(tables)) {
        const total = Math.round(items.reduce((s, i) => s + i.chance, 0) * 100) / 100;
        const priced = items.filter((i) => / Relic$/.test(i.itemName) || /^Arcane /.test(i.itemName)).map((i) => ({ n: i.itemName, c: i.chance }));
        if (total > 0) kept[rot] = { total, items: priced };
      }
      if (Object.values(kept).some((t) => t.items.length)) out.push({ planet, node, mode: v.gameMode, tables: kept });
    }
  }
  // the contents of each relic that a mission can drop, Intact and Radiant, so they can be valued with today's prices
  const wanted = new Set(out.flatMap((n) => Object.values(n.tables).flatMap((t) => t.items.filter((i) => / Relic$/.test(i.n)).map((i) => i.n.replace(/ Relic$/, "")))));
  const relics: Record<string, { intact: { n: string; c: number }[]; radiant: { n: string; c: number }[] }> = {};
  for (const r of relicRows) {
    const name = `${r.tier} ${r.relicName}`;
    if (!wanted.has(name) || (r.state !== "Intact" && r.state !== "Radiant")) continue;
    (relics[name] ??= { intact: [], radiant: [] })[r.state === "Intact" ? "intact" : "radiant"] = r.rewards.map((i) => ({ n: i.itemName, c: i.chance }));
  }
  writeFileSync("data/mission-rewards.json", JSON.stringify({ fetchedAt: new Date().toISOString(), nodes: out, relics }));
  console.log(`Wrote ${out.length} missions with relic or arcane rewards and ${Object.keys(relics).length} relics.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
