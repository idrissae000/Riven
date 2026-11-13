/**
 * Refreshes Prime part / set prices (average of the 5 cheapest online sell listings + the cheapest) from Warframe
 * Market. The app also refreshes stale prices in the background; this is for a full pass (or a cron job).
 *
 *   npm run sync:item-prices                # refresh whatever is stale, save to Supabase (needs the service key)
 *   npm run sync:item-prices -- --dry-run   # fetch all, write data/generated/item-prices.json, touch nothing
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fetchTop, type WfmGet } from "../src/lib/arcanes/refresh";
import { refreshItemBatch } from "../src/lib/primes/refresh";
import { primeCatalogue } from "../src/lib/primes/catalogue";

config({ path: ".env.local" });
config();

const HOST = "https://api.warframe.market";
const dry = process.argv.includes("--dry-run");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let last = 0;
const get: WfmGet = async (path) => {
  const wait = last + 400 - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  return fetch(HOST + path, { headers: { Accept: "application/json", Language: "en", Platform: "pc", "User-Agent": "WarframeEconomist/0.1 (price sync script)" } });
};

async function main() {
  const slugs = primeCatalogue.parts.map((p) => p.slug);
  if (dry) {
    const out: { slug: string; low: number | null; avg5: number | null; listings: number }[] = [];
    for (const [i, slug] of slugs.entries()) {
      out.push({ slug, ...(await fetchTop(get, slug, 0)) });
      if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${slugs.length}`);
    }
    mkdirSync("data/generated", { recursive: true });
    writeFileSync("data/generated/item-prices.json", JSON.stringify(out));
    console.log(`dry run: wrote data/generated/item-prices.json (${out.length} items, ${out.filter((r) => r.avg5 != null).length} with listings)`);
    return;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or use --dry-run)");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  for (;;) {
    const r = await refreshItemBatch(sb, get, slugs, { limit: 20 });
    console.log(`+${r.refreshed} (${r.remaining} left)`);
    if (r.rateLimited) throw new Error("Warframe Market rate-limited us; try again in a minute");
    if (r.remaining === 0) break;
  }
  console.log("done");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
