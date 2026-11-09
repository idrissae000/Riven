/**
 * Syncs every Warframe ability (name, owning Warframe, slot, cost, Helminth-subsumable flag, and which
 * ability stats it scales with) from the Warframe Wiki into the `abilities` table. Arcane pages match their
 * ability-scaling stat (e.g. Ability Strength) against these rows to list the abilities they work with.
 *
 *   npm run sync:wiki-abilities               # writes to Supabase
 *   npm run sync:wiki-abilities -- --dry-run  # writes data/generated/abilities.json
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseLuaModule } from "../src/lib/wiki/lua";
import { fetchPage } from "../src/lib/wiki/mediawiki";
import { buildAbilities, type LuaAbility } from "../src/lib/abilities/build";

config({ path: ".env.local" });
config();
const dry = process.argv.includes("--dry-run");

async function main() {
  const [data, stats] = await Promise.all([fetchPage("Module:Ability/data"), fetchPage("Module:Ability/data/stats")]);
  if (!data.content || !stats.content) throw new Error("Could not read the wiki ability modules");
  const abilities = (parseLuaModule(data.content) as unknown as { Ability?: Record<string, LuaAbility> }).Ability;
  if (!abilities) throw new Error("Module:Ability/data has no `Ability` table — the wiki format changed; update the parser.");
  const statLines = parseLuaModule(stats.content) as unknown as Record<string, { Modifier?: string }[]>;

  const rows = buildAbilities(abilities, statLines);
  const scaling = rows.filter((r) => r.modifiers.length).length;
  console.log(`${rows.length} abilities; ${scaling} scale with an ability stat; ${rows.filter((r) => r.helminth).length} Helminth-subsumable; ${new Set(rows.map((r) => r.warframe)).size} Warframes`);

  if (dry) {
    mkdirSync("data/generated", { recursive: true });
    writeFileSync("data/generated/abilities.json", JSON.stringify(rows, null, 2));
    console.log("dry run: wrote data/generated/abilities.json");
    return;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or use --dry-run)");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const now = new Date().toISOString();
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from("abilities").upsert(rows.slice(i, i + 200).map((r) => ({ ...r, synced_at: now })), { onConflict: "slug" });
    if (error) throw new Error(error.message);
  }
  console.log(`upserted ${rows.length} abilities`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
