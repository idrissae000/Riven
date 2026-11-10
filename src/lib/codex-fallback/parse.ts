import { createHash } from "node:crypto";
import { balancedLiteral, parseJsLiteral, type JsValue } from "../rivencalc/js-literal";
import type { CodexGradeBand, CodexLayout, CodexRivenData, CodexStat } from "./types";

/**
 * Extracts the riven reference data from the Codex Calculators page source (index.html).
 * Every number is read from the page's own code and CONFIRMED against the code that uses it — if the
 * structure changes so that something can't be confirmed, this throws instead of guessing.
 * The page is third-party content: it is only ever read as text, never executed.
 */
export function parseCodexRiven(
  html: string,
  meta: { url: string; repo: string; commit?: string | null; fetchedAt?: string },
  statSlugs: Record<string, string>,
): CodexRivenData {
  const need = (re: RegExp, what: string): RegExpExecArray => {
    const m = re.exec(html);
    if (!m) throw new Error(`Codex source changed: could not find ${what}. Update src/lib/codex-fallback/parse.ts.`);
    return m;
  };
  /** Parses the literal that follows e.g. `const S=`. */
  const literalAfter = (marker: RegExp, what: string): JsValue => {
    const m = need(marker, what);
    return parseJsLiteral(balancedLiteral(html, m.index + m[0].length));
  };
  const num = (v: JsValue, what: string): number => {
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`Codex source changed: ${what} is not a number (${JSON.stringify(v)})`);
    return v;
  };

  // ---- categories + base-value table -------------------------------------------------------------
  const categories = literalAfter(/const W=(?=\[)/, "the weapon category list (const W=)");
  if (!Array.isArray(categories) || !categories.every((c) => typeof c === "string")) throw new Error("Codex source changed: weapon categories are not strings");
  const table = literalAfter(/const S=(?=\[)/, "the base stat table (const S=)");
  if (!Array.isArray(table)) throw new Error("Codex source changed: base stat table is not an array");
  const stats: CodexStat[] = table.map((row) => {
    if (!Array.isArray(row) || row.length !== categories.length + 2) throw new Error(`Codex source changed: unexpected base-table row ${JSON.stringify(row)}`);
    const unit = row[row.length - 1];
    if (typeof row[0] !== "string" || !["%", "x", "s", "m", ""].includes(unit as string)) throw new Error(`Codex source changed: bad stat row ${JSON.stringify(row)}`);
    return { name: row[0], unit: unit as CodexStat["unit"], base: row.slice(1, 1 + categories.length).map((v) => (v === null ? null : num(v, `${row[0]} base`))) };
  });

  // ---- disposition factor: S.forEach(... r[j]=+(r[j]*1.2).toFixed(4)) ---------------------------------
  const dispo = need(/r\[j\]\s*=\s*\+\(\s*r\[j\]\s*\*\s*(\d*\.?\d+)\s*\)\.toFixed\(\s*(\d+)\s*\)/, "the disposition scaling applied to the base table");
  const disposition = { factor: Number(dispo[1]), decimals: Number(dispo[2]) };

  // ---- layouts (const C=[{id,p,n,b,m}, ...]) -----------------------------------------------------------
  const layoutsRaw = literalAfter(/const C=(?=\[)/, "the layout table (const C=)");
  if (!Array.isArray(layoutsRaw)) throw new Error("Codex source changed: layout table is not an array");
  const layouts: CodexLayout[] = layoutsRaw.map((l) => {
    const o = l as Record<string, JsValue>;
    if (typeof o?.id !== "string") throw new Error(`Codex source changed: bad layout ${JSON.stringify(l)}`);
    return { id: o.id, positives: num(o.p, "layout p"), negatives: num(o.n, "layout n"), positiveMultiplier: num(o.b, "layout b"), negativeMultiplier: num(o.m, "layout m") };
  });

  // ---- confirm the roll math from buildResultEntry -------------------------------------------------------
  // e = base * (neg ? st.d*cfg.m : st.d*cfg.b) * fl, lo = e*.9, hi = e*1.1
  need(/e\s*=\s*base\s*\*\s*\(\s*neg\s*\?\s*st\.d\s*\*\s*cfg\.m\s*:\s*st\.d\s*\*\s*cfg\.b\s*\)\s*\*\s*fl/, "the center-value formula (base × layout multiplier × flip)");
  const roll = need(/\blo\s*=\s*e\s*\*\s*(\d*\.?\d+)\s*,\s*hi\s*=\s*e\s*\*\s*(\d*\.?\d+)/, "the roll range (lo=e*…, hi=e*…)");
  const rollRange = { min: Number(roll[1]), max: Number(roll[2]) };
  if (!(rollRange.min > 0 && rollRange.max > rollRange.min)) throw new Error(`Codex source changed: nonsensical roll range ${JSON.stringify(rollRange)}`);

  // inverted stats: fl = s[0]==='Weapon Recoil' ? -1 : 1
  const invertedStats = [...new Set([...html.matchAll(/s\[0\]\s*===\s*'([^']+)'\s*\?\s*-1\s*:\s*1/g)].map((m) => m[1]))];

  // ---- grade bands ---------------------------------------------------------------------------------------
  const bandsRaw = literalAfter(/const RIVEN_GRADE_BANDS=(?=\[)/, "the grade bands (RIVEN_GRADE_BANDS)");
  if (!Array.isArray(bandsRaw)) throw new Error("Codex source changed: grade bands are not an array");
  const gradeBands: CodexGradeBand[] = bandsRaw.map((b) => {
    if (!Array.isArray(b) || typeof b[0] !== "string") throw new Error(`Codex source changed: bad grade band ${JSON.stringify(b)}`);
    return { grade: b[0], lower: num(b[1], "band lower"), upper: num(b[2], "band upper") };
  });
  gradeBands.sort((a, b) => a.lower - b.lower);
  // The bands must cover exactly the roll's deviation from center: (min-1)*100 .. (max-1)*100 percent.
  const lo = (rollRange.min - 1) * 100, hi = (rollRange.max - 1) * 100;
  const first = gradeBands[0], last = gradeBands[gradeBands.length - 1];
  if (Math.abs(first.lower - lo) > 1e-6 || Math.abs(last.upper - hi) > 1e-6) throw new Error(`Codex source changed: grade bands (${first.lower}..${last.upper}) don't span the roll range (${lo}..${hi})`);
  gradeBands.forEach((b, i) => { if (i > 0 && Math.abs(b.lower - gradeBands[i - 1].upper) > 1e-9) throw new Error(`Codex source changed: grade bands aren't contiguous at ${b.grade}`); });

  // ---- stats that can't be negative ------------------------------------------------------------------------
  const noNegRaw = need(/const NONEG=new Set\(\s*(?=\[)/, "the no-negative stat list (NONEG)");
  const noNegative = parseJsLiteral(balancedLiteral(html, noNegRaw.index + noNegRaw[0].length));
  if (!Array.isArray(noNegative)) throw new Error("Codex source changed: NONEG is not a list");

  // ---- weapon list: [name, categoryIndex, disposition, bow?] ---------------------------------------------------
  const wp = literalAfter(/const WP=(?=\[)/, "the weapon list (const WP=)");
  if (!Array.isArray(wp)) throw new Error("Codex source changed: weapon list is not an array");
  const weapons = wp.map((w) => {
    if (!Array.isArray(w) || typeof w[0] !== "string") throw new Error(`Codex source changed: bad weapon row ${JSON.stringify(w)}`);
    const category = num(w[1], `${w[0]} category`);
    return w[3] === 1 ? { name: w[0], category, bow: true } : { name: w[0], category }; // `bow` only when true: keeps the stored data small
  });

  // ---- cross-checks ------------------------------------------------------------------------------------------
  const known = new Set(stats.map((s) => s.name));
  const badSlugs = Object.entries(statSlugs).filter(([, n]) => !known.has(n));
  if (badSlugs.length) throw new Error(`Stat map points at stats the Codex doesn't have: ${badSlugs.map(([s, n]) => `${s}→${n}`).join(", ")}`);
  for (const n of invertedStats) if (!known.has(n)) throw new Error(`Inverted stat "${n}" isn't in the base table`);
  for (const w of weapons) if (w.category < 0 || w.category >= categories.length) throw new Error(`Weapon ${w.name} has category ${w.category}`);

  return {
    source: {
      url: meta.url,
      repo: meta.repo,
      commit: meta.commit ?? null,
      version: /<meta\s+name="riven-version"\s+content="([^"]+)"/.exec(html)?.[1] ?? null,
      sha256: createHash("sha256").update(html).digest("hex"),
      fetchedAt: meta.fetchedAt ?? new Date().toISOString(),
    },
    categories: categories as string[],
    disposition,
    stats,
    layouts,
    roll: rollRange,
    gradeBands,
    invertedStats,
    noNegative: noNegative.filter((n): n is string => typeof n === "string"),
    weapons,
    statSlugs,
  };
}
