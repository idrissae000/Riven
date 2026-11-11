import type { Estimate, Listing } from "./comparables";

/**
 * How a riven is valued from live Warframe Market asking prices. Every knob is here; nothing is hidden in the maths.
 *
 *   1. Pool: listings that carry all our stats ("exact") if there are enough of them, otherwise every comparable.
 *   2. Roll-quality adjustment: a listing with better rolls than ours asks more than ours is worth, and the reverse:
 *        adjusted = price × exp( ELASTICITY × (our quality − their quality) )     (capped at ±MAX_ADJUST in ln terms)
 *      Quality is the 0…1 score from the per-stat grades (positive rolls, plus the curse's fixed rating).
 *   3. Outliers (troll asks like 1p or 99,999p, or plain mispricing) are found in log-price space: anything further
 *      than OUTLIER_Z robust standard deviations (1.4826 × MAD, never below MIN_SCALE) from the weighted median goes.
 *   4. Weights: exact matches count more than partial ones; so do closer-valued, fresher listings and sellers who are
 *      in-game; and each seller counts once however many of their listings are in the pool.
 *   5. The estimate is the weighted 25th / 50th / 75th percentile of what's left.
 */
export const VALUATION = {
  /** ln-price change per +1.0 of quality (0.7 → the best roll asks ≈ 2× the worst). A prior, not a fit — see README. */
  ELASTICITY: 0.7,
  /** Largest |ln adjustment| applied to any one listing (0.35 ≈ ×1.42 / ×0.70). */
  MAX_ADJUST: 0.35,
  /** Robust spread is never taken below this (ln units, ≈ ±22%), so a tight cluster doesn't make normal asks "outliers". */
  MIN_SCALE: 0.2,
  OUTLIER_Z: 3,
  /** Listing age at which its weight halves, and the floor it can't go below. */
  HALF_LIFE_DAYS: 21,
  MIN_AGE_WEIGHT: 0.4,
  STATUS_WEIGHT: { ingame: 1, online: 0.95, offline: 0.85 } as Record<string, number>,
  /** A listing needs at least this many survivors for any estimate to be shown. */
  MIN_SAMPLES: 3,
} as const;

/** Weighted quantile with linear interpolation between mid-weight positions (equal weights → the usual percentile). */
export function weightedQuantile(values: number[], weights: number[], p: number): number {
  const idx = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const total = idx.reduce((s, i) => s + weights[i], 0);
  if (idx.length === 1 || total <= 0) return values[idx[0]];
  let acc = 0;
  const pos = idx.map((i) => { const mid = (acc + weights[i] / 2) / total; acc += weights[i]; return mid; });
  if (p <= pos[0]) return values[idx[0]];
  if (p >= pos[pos.length - 1]) return values[idx[idx.length - 1]];
  for (let k = 1; k < pos.length; k++) {
    if (p <= pos[k]) {
      const t = (p - pos[k - 1]) / (pos[k] - pos[k - 1]);
      return values[idx[k - 1]] + (values[idx[k]] - values[idx[k - 1]]) * t;
    }
  }
  return values[idx[idx.length - 1]];
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function baseWeight(l: Listing, now: number): number {
  const match = l.matchKind === "exact" ? 1 : 0.4 + 0.4 * (l.total ? l.matched / l.total : 0);
  const closeness = 0.6 + 0.4 * clamp(l.score, 0, 1);
  const ageDays = Math.max(0, (now - Date.parse(l.postedAt)) / 864e5);
  const age = Number.isFinite(ageDays) ? Math.max(VALUATION.MIN_AGE_WEIGHT, Math.pow(0.5, ageDays / VALUATION.HALF_LIFE_DAYS)) : 1;
  const status = VALUATION.STATUS_WEIGHT[l.sellerStatus] ?? 0.85;
  return match * closeness * age * status;
}

export interface Valuation {
  estimate: Estimate | null;
  /** The pool the estimate is based on, annotated (weight, adjusted price, outlier flag). Always safe to cite. */
  listings: Listing[];
}

/**
 * Value a riven from its comparable listings. `ourQuality` is the riven's 0…1 quality score (null = unknown, so no
 * quality adjustment is made). Never returns an estimate without enough listings behind it.
 */
export function valuate(listings: Listing[], ourQuality: number | null, now = Date.now()): Valuation {
  const exact = listings.filter((l) => l.matchKind === "exact");
  const useExact = exact.length >= VALUATION.MIN_SAMPLES;
  const pool = useExact ? exact : listings;
  if (pool.length === 0) return { estimate: null, listings: [] };

  // each seller counts once however many of their listings are in the pool
  const perSeller = new Map<string, number>();
  for (const l of pool) perSeller.set(l.seller, (perSeller.get(l.seller) ?? 0) + 1);

  const rows = pool.map((l) => {
    const adj = ourQuality != null && l.quality != null ? clamp(VALUATION.ELASTICITY * (ourQuality - l.quality), -VALUATION.MAX_ADJUST, VALUATION.MAX_ADJUST) : 0;
    return { l, adj, ln: Math.log(Math.max(1, l.price)) + adj, w: baseWeight(l, now) / (perSeller.get(l.seller) ?? 1) };
  });

  // outliers, in log-price space
  let outlierIdx = new Set<number>();
  if (rows.length >= VALUATION.MIN_SAMPLES) {
    const lns = rows.map((r) => r.ln), ws = rows.map((r) => r.w);
    const med = weightedQuantile(lns, ws, 0.5);
    const mad = weightedQuantile(lns.map((x) => Math.abs(x - med)), ws, 0.5);
    const scale = Math.max(1.4826 * mad, VALUATION.MIN_SCALE);
    outlierIdx = new Set(rows.flatMap((r, i) => (Math.abs(r.ln - med) > VALUATION.OUTLIER_Z * scale ? [i] : [])));
  }

  const kept = rows.filter((_, i) => !outlierIdx.has(i));
  const annotated = rows.map((r, i) => ({ ...r.l, weight: outlierIdx.has(i) ? 0 : +r.w.toFixed(4), adjustedPrice: Math.max(1, Math.round(Math.exp(r.ln))), outlier: outlierIdx.has(i) }));
  if (kept.length < VALUATION.MIN_SAMPLES) return { estimate: null, listings: annotated };

  const lns = kept.map((r) => r.ln), ws = kept.map((r) => r.w);
  const q = (p: number) => Math.max(1, Math.round(Math.exp(weightedQuantile(lns, ws, p))));
  const lowLn = weightedQuantile(lns, ws, 0.25), highLn = weightedQuantile(lns, ws, 0.75);
  const spread = highLn - lowLn;
  const sw = ws.reduce((a, b) => a + b, 0), nEff = (sw * sw) / ws.reduce((a, b) => a + b * b, 0);
  const confidence: Estimate["confidence"] = kept.length >= 8 && nEff >= 6 && spread <= 0.5 ? "high" : kept.length >= 5 && spread <= 1 ? "medium" : "low";

  return {
    estimate: {
      low: q(0.25), median: q(0.5), high: q(0.75),
      basis: useExact ? "exact" : "similar",
      sampleSize: kept.length,
      outliers: outlierIdx.size,
      adjusted: kept.some((r) => r.adj !== 0),
      confidence,
    },
    listings: annotated,
  };
}
