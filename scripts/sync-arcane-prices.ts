/**
 * Refreshes arcane market prices (rank 0) from Warframe Market: the average of the five cheapest online listings, the
 * cheapest listing, and the last-48h sales volume / average. The app also refreshes stale prices in the background;
 * this is for a full pass (or a cron job).
 *
 *   npm run sync:arcane-prices                # refresh everything that's stale, save to Supabase (needs the service key)
 *   npm run sync:arcane-prices -- --all       # refresh everything regardless of age
 *   npm run sync:arcane-prices -- --dry-run   # fetch all, write data/generated/arcane-prices.json, touch nothing
 */
import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fetchPriceRow, fetchStatsRow, refreshArcaneBatch, type PriceRow, type StatsRow, type WfmGet } from "../src/lib/arcanes/refresh";

config({ path: ".env.local" });
config();

const HOST = "https://api.warframe.market";
const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const all = args.includes("--all");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let last = 0;
const get: WfmGet = async (path) => {
  const wait = last + 400 - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  return fetch(HOST + path, { headers: { Accept: "application/json", Language: "en", Platform: "pc", "User-Agent": "RivenBuddy/0.1 (price sync script)" } });
};

async function main() {
  if (dry) {
    const arcanes = (JSON.parse(readFileSync("data/generated/arcanes.json", "utf8")) as { slug: string; wfm_slug: string | null; max_rank: number | null }[]).filter((a) => a.wfm_slug);
    const now = new Date().toISOString();
    const out: (PriceRow & Partial<StatsRow>)[] = [];
    for (const [i, a] of arcanes.entries()) {
      const price = await fetchPriceRow(get, a.slug, a.wfm_slug!, now, a.max_rank);
      const stats = await fetchStatsRow(get, a.slug, a.wfm_slug!, now);
      out.push({ ...price, volume_48h: stats.volume_48h, sold_avg_48h: stats.sold_avg_48h, stats_at: stats.stats_at });
      if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${arcanes.length}`);
    }
    mkdirSync("data/generated", { recursive: true });
    writeFileSync("data/generated/arcane-prices.json", JSON.stringify(out));
    console.log(`dry run: wrote data/generated/arcane-prices.json (${out.length} arcanes, ${out.filter((r) => r.avg5 != null).length} with listings)`);
    return;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or use --dry-run)");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  if (all) await sb.from("arcane_prices").update({ fetched_at: null, stats_at: null }).neq("slug", "");
  for (;;) {
    const r = await refreshArcaneBatch(sb, get, { priceLimit: 10, statsLimit: 5 });
    console.log(`prices +${r.prices} (${r.remaining.prices} left) · stats +${r.stats} (${r.remaining.stats} left)`);
    if (r.rateLimited) throw new Error("Warframe Market rate-limited us; try again in a minute");
    if (r.remaining.prices === 0 && r.remaining.stats === 0) break;
  }
  console.log("done");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
