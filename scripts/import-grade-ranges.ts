/**
 * Loads roll-range data (the "real tables") into riven_grade_ranges.
 *
 *   npm run import:grading -- data/grading/placeholder-ranges.json      # stand-ins (flagged is_placeholder)
 *   npm run import:grading -- path/to/real-ranges.csv                    # real data (is_placeholder=false)
 *   npm run import:grading -- path/to/real-ranges.csv --replace-placeholders   # also deletes remaining placeholder rows
 *   add --dry-run to validate without touching the database.
 *
 * Format: see src/lib/grading/import-parse.ts. Dropping in a real dataset is a data
 * change only — no code change.
 */
import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseDataset } from "../src/lib/grading/import-parse";

config({ path: ".env.local" });
config();

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("usage: import-grade-ranges <file.json|file.csv> [--dry-run] [--replace-placeholders]");
  const dry = args.includes("--dry-run");

  const ds = parseDataset(readFileSync(file, "utf8"), file);
  const placeholder = ds.is_placeholder ?? false;
  const source = ds.source ?? file;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

  // Validate weapon / stat slugs against reference data (DB if available, else the dry-run JSON).
  let weapons: Set<string> | null = null;
  let stats: Set<string> | null = null;
  if (sb) {
    weapons = new Set(((await sb.from("weapons").select("slug")).data ?? []).map((r) => r.slug));
    stats = new Set(((await sb.from("riven_attributes").select("slug")).data ?? []).map((r) => r.slug));
  } else if (existsSync("data/generated/weapons.json")) {
    weapons = new Set((JSON.parse(readFileSync("data/generated/weapons.json", "utf8")) as { slug: string }[]).map((r) => r.slug));
    stats = new Set((JSON.parse(readFileSync("data/generated/riven_attributes.json", "utf8")) as { slug: string }[]).map((r) => r.slug));
  }
  const errors = [...ds.errors];
  for (const r of ds.rows) {
    if (weapons && weapons.size && r.weapon_slug !== "*" && !weapons.has(r.weapon_slug)) errors.push(`unknown weapon slug "${r.weapon_slug}"`);
    if (stats && stats.size && !stats.has(r.stat_slug)) errors.push(`unknown stat slug "${r.stat_slug}"`);
  }
  if (errors.length) {
    console.error(`${errors.length} problem(s):\n - ${[...new Set(errors)].join("\n - ")}`);
    process.exit(1);
  }
  console.log(`${ds.rows.length} range rows OK (${placeholder ? "PLACEHOLDER" : "real data"}, source: ${source})`);
  if (dry) return;
  if (!sb) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or use --dry-run)");

  const rows = ds.rows.map((r) => ({ ...r, is_placeholder: placeholder, source, updated_at: new Date().toISOString() }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from("riven_grade_ranges").upsert(rows.slice(i, i + 200), { onConflict: "weapon_slug,stat_slug,is_negative" });
    if (error) throw new Error(error.message);
  }
  console.log(`upserted ${rows.length} rows into riven_grade_ranges`);

  if (!placeholder && args.includes("--replace-placeholders")) {
    const { error, count } = await sb.from("riven_grade_ranges").delete({ count: "exact" }).eq("is_placeholder", true);
    if (error) throw new Error(error.message);
    console.log(`removed ${count ?? 0} leftover placeholder rows`);
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
