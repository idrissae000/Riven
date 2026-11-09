/**
 * Syncs arcane data into Supabase. Sources:
 *   - Warframe Wiki  (wiki.warframe.com): Module:Arcane/data (effects, slot, rarity, stat tags)
 *                    + each arcane page (drop sources from {{Acquisition}}, compatibility notes)
 *   - Warframe Market v2: item slug + icon for pricing
 *   - data/arcane-upgrade-types.json  (readable labels/categories for the wiki's stat tags)
 *   - data/arcane-overrides.json      (your hand-curated compatibility / drop sources — wins over the wiki)
 *
 * Re-run whenever the game updates:    npm run sync:wiki-arcanes
 * Inspect without a database:          npm run sync:wiki-arcanes -- --dry-run   (writes data/generated/arcanes.json)
 */
import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseLuaModule } from "../src/lib/wiki/lua";
import { fetchPage, fetchPages } from "../src/lib/wiki/mediawiki";
import { buildArcane, type ArcaneRecord, type LuaArcane, type Overrides, type UpgradeTypeMap } from "../src/lib/arcanes/build";

config({ path: ".env.local" });
config();

const dry = process.argv.includes("--dry-run");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8"));

interface WfmItem { slug: string; tags?: string[]; i18n: { en: { name: string; thumb?: string } } }

async function wfmArcanes(): Promise<Map<string, WfmItem>> {
  const res = await fetch("https://api.warframe.market/v2/items", { headers: { Language: "en", Accept: "application/json", "User-Agent": "RivenBuddy/0.1 (personal tool)" } });
  if (!res.ok) throw new Error(`WFM /v2/items -> ${res.status}`);
  const items = ((await res.json()) as { data: WfmItem[] }).data.filter((i) => i.tags?.includes("arcane_enhancement"));
  return new Map(items.map((i) => [norm(i.i18n.en.name), i]));
}

async function main() {
  console.log("Fetching Module:Arcane/data …");
  const mod = await fetchPage("Module:Arcane/data");
  if (!mod.content) throw new Error("Could not read Module:Arcane/data from the wiki");
  const lua = (parseLuaModule(mod.content) as unknown as { Arcanes?: Record<string, LuaArcane> }).Arcanes;
  if (!lua) throw new Error("Module:Arcane/data has no `Arcanes` table — the wiki's data format changed; update the parser.");
  const entries = Object.entries(lua);
  console.log(`  ${entries.length} arcanes (module rev ${mod.revid})`);

  console.log("Fetching arcane pages …");
  const titles = entries.map(([name, a]) => a.Link ?? a.Name ?? name);
  const pages = await fetchPages(titles);

  console.log("Fetching Warframe Market arcane list …");
  const wfm = await wfmArcanes();

  const upgradeMap = readJson<UpgradeTypeMap>("data/arcane-upgrade-types.json");
  const overrides = readJson<Record<string, Overrides>>("data/arcane-overrides.json");
  const unmapped = new Set<string>();

  const records: (ArcaneRecord & { wfm_icon: string | null })[] = entries.map(([name, a]) => {
    const title = a.Link ?? a.Name ?? name;
    const page = pages.get(title);
    const rec = buildArcane({ ...a, Name: a.Name ?? name }, page?.content ?? null, page?.revid ?? null, upgradeMap, overrides[a.Name ?? name], unmapped);
    const item = wfm.get(norm(rec.name));
    if (item) rec.wfm_slug = item.slug;
    else rec.needs_review.push("not matched to a Warframe Market item (no price)");
    return { ...rec, wfm_icon: item?.i18n.en.thumb ?? null };
  });

  // ---- report ----
  const matched = new Set(records.map((r) => r.wfm_slug).filter(Boolean));
  const wfmOnly = [...wfm.values()].filter((i) => !matched.has(i.slug)).map((i) => i.i18n.en.name);
  console.log(`\n${records.length} arcanes built.`);
  console.log(`  with drop sources : ${records.filter((r) => r.drop_sources.length).length}`);
  console.log(`  with WFM price id : ${records.filter((r) => r.wfm_slug).length}`);
  console.log(`  ability-scaling   : ${records.filter((r) => r.compatibility.ability_scaling).length}`);
  console.log(`  overridden        : ${records.filter((r) => r.overridden_fields.length).length}`);
  if (unmapped.size) console.log(`  UNMAPPED upgrade types (add to data/arcane-upgrade-types.json): ${[...unmapped].join(", ")}`);
  const noDrops = records.filter((r) => !r.drop_sources.length).map((r) => r.name);
  if (noDrops.length) console.log(`  no drop sources (${noDrops.length}): ${noDrops.slice(0, 12).join(", ")}${noDrops.length > 12 ? " …" : ""}`);
  if (wfmOnly.length) console.log(`  on WFM but not in wiki data (${wfmOnly.length}): ${wfmOnly.slice(0, 12).join(", ")}${wfmOnly.length > 12 ? " …" : ""}`);

  if (dry) {
    mkdirSync("data/generated", { recursive: true });
    writeFileSync("data/generated/arcanes.json", JSON.stringify(records, null, 2));
    console.log("\ndry run: wrote data/generated/arcanes.json");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or use --dry-run)");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const now = new Date().toISOString();
  const rows = records.map((r) => ({ ...r, synced_at: now, wiki_icon: undefined }));
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await sb.from("arcanes").upsert(rows.slice(i, i + 100), { onConflict: "slug" });
    if (error) throw new Error(error.message);
  }
  console.log(`\nupserted ${rows.length} arcanes`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
