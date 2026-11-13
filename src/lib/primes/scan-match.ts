/** One line the model read off an inventory screenshot. `rank` is the arcane rank shown on its tile (arcanes only). */
export interface ReadItem { name: string; qty: number; rank?: number | null }
/** Anything with a name we can match against (a Prime part, an arcane). */
export interface Named { slug: string; name: string }
export interface MatchedItem {
  slug: string; name: string; qty: number;
  /** what the screenshot said, when it wasn't an exact match */
  readAs: string | null;
  /** 0 = unranked / not an arcane; otherwise the arcane's max rank (arcanes are tracked at those two). */
  rank: number;
  /** An arcane the screenshot showed at an in-between rank (we only track unranked and max rank): the rank it showed. */
  seenRank?: number | null;
}
export interface ScanMatch { matched: MatchedItem[]; unmatched: ReadItem[] }

/** Lowercase, drop punctuation and the words screenshots add ("blueprint" stays — it is part of many names). */
export const norm = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** 1 = identical, 0 = nothing alike (edit distance over the longer string). */
export const similarity = (a: string, b: string) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);

const MIN_SIMILARITY = 0.84;
/** The best runner-up must be clearly worse, otherwise a misread could be either part and we'd rather ask. */
const MIN_MARGIN = 0.04;

/**
 * Matches names read from a screenshot to Prime parts. Exact (after normalising) first; otherwise the closest name, but only
 * when it is close enough and clearly closer than the next one ("Frost Prime Chassis" vs "Frost Prime Neuroptics" must never mix).
 * Sets are matched too. Lines whose quantity is missing count as 1. For arcanes (`maxRankOf` given) a tile at max rank is kept
 * as max rank; unranked or in-between ranks are kept unranked (in-between ones remember what they showed).
 */
export function matchRead(read: ReadItem[], parts: Named[], maxRankOf?: (slug: string) => number | null): ScanMatch {
  const index = parts.map((p) => ({ p, n: norm(p.name) }));
  const exact = new Map(index.map((x) => [x.n, x.p]));
  const out = new Map<string, MatchedItem>();
  const unmatched: ReadItem[] = [];

  for (const r of read) {
    const n = norm(r.name);
    const qty = Number.isFinite(r.qty) && r.qty >= 1 ? Math.min(9999, Math.round(r.qty)) : 1;
    if (!n) continue;
    let part = exact.get(n) ?? null;
    let readAs: string | null = null;
    if (!part) {
      const ranked = index.map((x) => ({ x, s: similarity(n, x.n) })).sort((a, b) => b.s - a.s);
      const [best, next] = ranked;
      if (best && best.s >= MIN_SIMILARITY && (!next || best.s - next.s >= MIN_MARGIN)) { part = best.x.p; readAs = r.name; }
    }
    if (!part) { unmatched.push({ name: r.name, qty }); continue; }
    const max = maxRankOf?.(part.slug) ?? null;
    const seen = max != null && typeof r.rank === "number" && r.rank > 0 ? r.rank : null;
    const rank = max != null && seen === max ? max : 0;
    const key = `${part.slug}:${rank}`;
    const have = out.get(key);
    // the same item listed twice on one screenshot is the same stack seen twice, not two stacks
    if (have) have.qty = Math.max(have.qty, qty);
    else out.set(key, { slug: part.slug, name: part.name, qty, readAs, rank, seenRank: seen != null && seen !== max ? seen : null });
  }
  return { matched: [...out.values()], unmatched };
}

/**
 * Combines the results of several screenshots. Inventory screenshots usually overlap (scrolling a list), so with "max" an item seen
 * in more than one is taken at its largest quantity. Mission-reward screenshots are each new loot, so with "sum" they add up.
 */
export function mergeScans(scans: ScanMatch[], how: "max" | "sum" = "max"): ScanMatch {
  const m = new Map<string, MatchedItem>();
  const un = new Map<string, ReadItem>();
  for (const s of scans) {
    for (const i of s.matched) {
      const key = `${i.slug}:${i.rank}`;
      const have = m.get(key);
      if (!have) m.set(key, { ...i });
      else { have.qty = how === "sum" ? Math.min(9999, have.qty + i.qty) : Math.max(have.qty, i.qty); have.readAs ??= i.readAs; }
    }
    for (const u of s.unmatched) {
      const k = norm(u.name);
      const have = un.get(k);
      if (!have) un.set(k, { ...u }); else have.qty = how === "sum" ? have.qty + u.qty : Math.max(have.qty, u.qty);
    }
  }
  return { matched: [...m.values()], unmatched: [...un.values()] };
}

export interface ScanRow extends MatchedItem { unit: number | null; total: number | null; ducats: number | null }

/** Values the matched items (`priceOf` = market price of one) and orders them most expensive first; unpriced items go last. */
export function valueScan(items: MatchedItem[], priceOf: (slug: string, rank: number) => number | null, ducatsOf: (slug: string) => number | null = () => null) {
  const rows = items.map((i): ScanRow => {
    const unit = priceOf(i.slug, i.rank);
    return { ...i, unit, total: unit == null ? null : Math.round(unit * i.qty * 10) / 10, ducats: ducatsOf(i.slug) };
  });
  // "most expensive to cheapest": order by what ONE sells for, so a stack of 20 cheap parts doesn't outrank a 120p part
  rows.sort((a, b) => (b.unit ?? -1) - (a.unit ?? -1) || a.name.localeCompare(b.name));
  const priced = rows.filter((r) => r.total != null);
  return { rows, total: Math.round(priced.reduce((s, r) => s + (r.total as number), 0) * 10) / 10, priced: priced.length };
}
