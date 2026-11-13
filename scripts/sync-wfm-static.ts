/**
 * Syncs riven reference data from the Warframe Market v2 API into Supabase:
 *   - weapons (with real riven disposition + mastery requirement)
 *   - riven_attributes (stat definitions, positive-only flags, riven-type restrictions)
 *
 * Re-run any time the game changes:   npm run sync:wfm-static
 * Inspect without a database:         npm run sync:wfm-static -- --dry-run
 */
import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const BASE = "https://api.warframe.market/v2";
const dry = process.argv.includes("--dry-run");
const overrides: Record<string, { inverted?: boolean }> = JSON.parse(readFileSync("data/riven-attribute-overrides.json", "utf8"));

async function wfm<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { headers: { Language: "en", Accept: "application/json", "User-Agent": "WarframeEconomist/0.1 (personal tool)" } });
  if (!res.ok) throw new Error(`WFM ${path} -> ${res.status}`);
  return ((await res.json()) as { data: T }).data;
}

interface WfmWeapon {
  slug: string; group?: string; rivenType: string; disposition?: number; reqMasteryRank?: number;
  i18n: { en: { name: string; thumb?: string } };
}
interface WfmAttr {
  slug: string; prefix?: string; suffix?: string; unit?: string; exclusiveTo?: string[]; positiveOnly?: boolean;
  i18n: { en: { name: string } };
}

async function main() {
  const weapons = await wfm<WfmWeapon[]>("/riven/weapons");
  await new Promise((r) => setTimeout(r, 400)); // stay well under 3 req/s
  const attrs = await wfm<WfmAttr[]>("/riven/attributes");

  const weaponRows = weapons.map((w) => ({
    slug: w.slug,
    name: w.i18n.en.name,
    riven_type: w.rivenType,
    group_name: w.group ?? null,
    disposition: w.disposition ?? null,
    req_mastery: w.reqMasteryRank ?? null,
    icon: w.i18n.en.thumb ?? null,
    synced_at: new Date().toISOString(),
  }));
  const attrRows = attrs.map((a) => ({
    slug: a.slug,
    name: a.i18n.en.name,
    unit: a.unit ?? null,
    exclusive_to: a.exclusiveTo ?? null,
    positive_only: a.positiveOnly ?? false,
    inverted: overrides[a.slug]?.inverted ?? false,
    prefix: a.prefix ?? null,
    suffix: a.suffix ?? null,
    synced_at: new Date().toISOString(),
  }));

  console.log(`weapons: ${weaponRows.length}, attributes: ${attrRows.length}`);
  console.log("units:", [...new Set(attrRows.map((a) => a.unit))]);
  console.log("riven types:", [...new Set(weaponRows.map((w) => w.riven_type))]);

  if (dry) {
    mkdirSync("data/generated", { recursive: true });
    writeFileSync("data/generated/weapons.json", JSON.stringify(weaponRows, null, 2));
    writeFileSync("data/generated/riven_attributes.json", JSON.stringify(attrRows, null, 2));
    console.log("dry run: wrote data/generated/*.json");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or use --dry-run)");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const targets: [string, Record<string, unknown>[]][] = [["weapons", weaponRows], ["riven_attributes", attrRows]];
  for (const [table, rows] of targets) {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await sb.from(table).upsert(rows.slice(i, i + 200), { onConflict: "slug" });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    console.log(`upserted ${rows.length} -> ${table}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
