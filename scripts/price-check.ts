/**
 * Dev tool: run the real pricing pipeline against live Warframe Market data.
 *   npm run price-check -- soma "Acri-cron" critical_damage=120 critical_chance=150 zoom=-40 [--rank=8]
 * Stats ending in a negative value are treated as the negative stat.
 */
import { priceRiven } from "../src/lib/wfm/pricing";
import { wfmGet } from "../src/lib/wfm/client";
import type { Riven, RivenAttribute } from "../src/lib/types";

async function main() {
  const args = process.argv.slice(2);
  const rankArg = args.find((a) => a.startsWith("--rank="));
  const [weapon, name, ...rest] = args.filter((a) => !a.startsWith("--"));
  if (!weapon) throw new Error("usage: price-check <weapon-slug> <riven name> stat=value ...");
  const stats = rest.map((kv) => {
    const [stat, v] = kv.split("=");
    const value = Number(v);
    return { stat, value, is_negative: value < 0 };
  });
  const attrsRes = await wfmGet<{ data: { slug: string; unit?: string; i18n: { en: { name: string } } }[] }>("/v2/riven/attributes");
  const attributes = attrsRes.data.data.map((a) => ({ slug: a.slug, name: a.i18n.en.name, unit: a.unit ?? null, exclusive_to: null, positive_only: false, prefix: null, suffix: null })) as RivenAttribute[];

  const riven = {
    id: "cli", user_id: "cli", weapon_slug: weapon, riven_name: name || null, polarity: "madurai", mastery_rank: 10,
    rank: rankArg ? Number(rankArg.split("=")[1]) : 8, rerolls: 0, stats, has_negative: stats.some((s) => s.is_negative),
    notes: null, created_at: "", updated_at: "",
  } as Riven;

  const r = await priceRiven(riven, attributes);
  console.log("estimate:", r.estimate, "| note:", r.note, `| queries: ${r.queries}, cached: ${r.fromCache}`);
  for (const l of r.listings) {
    console.log(`${String(l.price).padStart(5)}p  ${l.matchKind.padEnd(7)} score ${l.score.toFixed(2)}  ${l.rivenName.padEnd(16)} r${l.rank}  ${l.seller} (${l.sellerStatus})  ${l.stats.map((s) => `${s.stat}:${s.value}`).join(" ")}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
