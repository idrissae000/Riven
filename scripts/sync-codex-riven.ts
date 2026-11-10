/**
 * Syncs the riven grading reference data from the Codex Riven Calculator
 * (https://unified-codex.github.io/Codex-Calculators/?tool=riven) into Supabase (`riven_grading_data`):
 *   base stat table per weapon category, layout multipliers, roll range, grade bands, weapon categories.
 *
 * The calculator is a static page whose logic and tables live inline in index.html (repo
 * Unified-Codex/Codex-Calculators). We read that source as TEXT — never execute it — and parse each table from
 * its own code, confirming the roll math against the calculator's formulas. If the structure changes the parser
 * throws instead of guessing.
 *
 *   npm run sync:codex-riven                               # fetch latest, upsert into Supabase
 *   npm run sync:codex-riven -- --dry-run                  # parse + write data/generated/codex-riven.json only
 *   npm run sync:codex-riven -- --file path/index.html     # use a local copy (e.g. a git clone) instead of fetching
 */
import { config } from "dotenv";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseCodexRiven } from "../src/lib/codex/parse";

config({ path: ".env.local" });
config();

const REPO = "Unified-Codex/Codex-Calculators";
const SOURCES = [
  `https://raw.githubusercontent.com/${REPO}/main/index.html`,
  "https://unified-codex.github.io/Codex-Calculators/index.html",
];
const UA = "RivenBuddy/0.1 (personal tool; codex sync script)";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

async function loadSource(): Promise<{ html: string; url: string; commit: string | null }> {
  const file = opt("--file");
  if (file) {
    let commit: string | null = opt("--commit") ?? null;
    if (!commit) {
      try { commit = execFileSync("git", ["-C", dirname(file), "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* not a git checkout */ }
    }
    return { html: readFileSync(file, "utf8"), url: `file:${file}`, commit };
  }
  let lastErr: unknown;
  for (const url of SOURCES) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let commit: string | null = null;
      try { // best effort: which commit is that?
        const c = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, { headers: { "User-Agent": UA, Accept: "application/vnd.github+json" } });
        if (c.ok) commit = ((await c.json()) as { sha?: string }).sha ?? null;
      } catch { /* optional */ }
      return { html: await res.text(), url, commit };
    } catch (e) {
      lastErr = e;
      console.warn(`  could not fetch ${url}: ${e instanceof Error ? e.message : e}`);
    }
  }
  throw new Error(`Could not fetch the Codex calculator from any source (${lastErr instanceof Error ? lastErr.message : lastErr}). Use --file with a local copy.`);
}

async function main() {
  console.log("Reading the Codex Riven Calculator source …");
  const { html, url, commit } = await loadSource();
  console.log(`  ${(html.length / 1e6).toFixed(2)} MB from ${url}${commit ? ` @ ${commit.slice(0, 10)}` : ""}`);

  const statMap = (JSON.parse(readFileSync("data/codex-stat-map.json", "utf8")) as { stats: Record<string, string> }).stats;
  const data = parseCodexRiven(html, { url: url.startsWith("file:") ? `https://unified-codex.github.io/Codex-Calculators/?tool=riven` : url, repo: REPO, commit }, statMap);

  console.log(`  calculator version ${data.source.version ?? "?"}, sha256 ${data.source.sha256.slice(0, 12)}`);
  console.log(`  ${data.stats.length} stats × ${data.categories.length} categories (${data.categories.join(", ")})`);
  console.log(`  disposition ×${data.disposition.factor} (${data.disposition.decimals} dp) · roll ×${data.roll.min}–×${data.roll.max}`);
  console.log(`  layouts: ${data.layouts.map((l) => `${l.id} (${l.positiveMultiplier}${l.negatives ? ` / ${l.negativeMultiplier}` : ""})`).join(", ")}`);
  console.log(`  grade bands: ${[...data.gradeBands].reverse().map((b) => b.grade).join(" > ")}`);
  console.log(`  inverted stats: ${data.invertedStats.join(", ") || "none"} · ${data.weapons.length} weapons (${data.weapons.filter((w) => w.bow).length} bows)`);

  // Coverage vs Warframe Market's riven attributes, so a renamed stat is noticed.
  const wfmPath = "data/generated/riven_attributes.json";
  if (existsSync(wfmPath)) {
    const wfm = (JSON.parse(readFileSync(wfmPath, "utf8")) as { slug: string }[]).map((a) => a.slug);
    const unmapped = wfm.filter((s) => !statMap[s]);
    if (unmapped.length) console.warn(`  ! WFM attributes with no Codex mapping (add to data/codex-stat-map.json): ${unmapped.join(", ")}`);
    else console.log(`  all ${wfm.length} Warframe Market riven stats map to a Codex stat`);
  }

  if (flag("--dry-run")) {
    mkdirSync("data/generated", { recursive: true });
    writeFileSync("data/generated/codex-riven.json", JSON.stringify(data));
    console.log("dry run: wrote data/generated/codex-riven.json");
    return;
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or use --dry-run)");
  const sb = createClient(supaUrl, key, { auth: { persistSession: false } });
  const prev = await sb.from("riven_grading_data").select("data").eq("id", "codex").maybeSingle();
  const prevSha = (prev.data?.data as { source?: { sha256?: string } } | undefined)?.source?.sha256;
  if (prevSha === data.source.sha256) console.log("  (source unchanged since the last sync)");
  const { error } = await sb.from("riven_grading_data").upsert({ id: "codex", data, synced_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  console.log("upserted riven_grading_data/codex");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
