/**
 * Rebuilds data/primes.json: every Prime part / blueprint / set tradable on Warframe Market and every Lith–Axi relic with
 * the six things it drops and whether it's vaulted. Sources: Warframe Market /v2/items (names, ducats, vaulted relics) and
 * the game's export data on browse.wf (ExportRelics + ExportRewards). Re-run after a game update:
 *
 *   npm run sync:primes
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { buildPrimes, type ExportRelic, type ExportRewards, type WfmItem } from "../src/lib/primes/build";
import type { PrimeCatalogue } from "../src/lib/primes/types";

const ITEMS = "https://api.warframe.market/v2/items";
const RELICS = "https://browse.wf/warframe-public-export-plus/ExportRelics.json";
const REWARDS = "https://browse.wf/warframe-public-export-plus/ExportRewards.json";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

async function text(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers: { "User-Agent": "RivenBuddy/0.1 (prime sync script)", ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function main() {
  console.log("Fetching Warframe Market items and the game's relic data …");
  const [items, relics, rewards] = await Promise.all([text(ITEMS, { Accept: "application/json", Language: "en" }), text(RELICS), text(REWARDS)]);
  const wfmItems = (JSON.parse(items) as { data: WfmItem[] }).data;

  // how many of each part a set needs: GET /v2/item/{set}/set (one small request per set)
  console.log("Reading set compositions …");
  const setQuantities: Record<string, number> = {};
  const sets = wfmItems.filter((i) => i.tags?.includes("prime") && i.tags.includes("set"));
  for (const [n, set] of sets.entries()) {
    const body = JSON.parse(await text(`https://api.warframe.market/v2/item/${set.slug}/set`, { Accept: "application/json", Language: "en" })) as { data?: { items?: { slug: string; quantityInSet?: number; setRoot?: boolean }[] } };
    for (const part of body.data?.items ?? []) if (!part.setRoot && (part.quantityInSet ?? 1) > 1) setQuantities[part.slug] = part.quantityInSet as number;
    await new Promise((r) => setTimeout(r, 400));
    if ((n + 1) % 40 === 0) console.log(`  ${n + 1}/${sets.length}`);
  }
  console.log(`  ${Object.keys(setQuantities).length} parts need more than one copy per set`);

  const built = buildPrimes({ items: wfmItems, relics: JSON.parse(relics) as Record<string, ExportRelic>, rewards: JSON.parse(rewards) as ExportRewards, setQuantities });
  const data: PrimeCatalogue = {
    source: { itemsUrl: ITEMS, relicsUrl: RELICS, rewardsUrl: REWARDS, sha256: { items: sha(items), relics: sha(relics), rewards: sha(rewards) }, fetchedAt: new Date().toISOString() },
    ...built,
  };
  const noDucats = data.parts.filter((p) => p.ducats == null).length;
  console.log(`  ${data.parts.filter((p) => p.kind === "part").length} parts, ${data.parts.filter((p) => p.kind === "set").length} sets, ${data.relics.length} relics (${data.relics.filter((r) => !r.vaulted).length} unvaulted)`);
  console.log(`  parts that drop from relics: ${data.parts.filter((p) => p.relics.length).length} · not from relics (Baro / exclusives): ${data.parts.filter((p) => p.kind === "part" && !p.relics.length).length} · no ducat value: ${noDucats}`);
  console.log(`  relic rewards with no market item (untradable, e.g. Forma): ${data.relics.reduce((n, r) => n + [...r.common, ...r.uncommon, r.rare].filter((w) => !w).length, 0)}`);
  writeFileSync("data/primes.json", JSON.stringify(data));
  console.log("wrote data/primes.json");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
