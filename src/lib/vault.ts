/** One riven's last market estimate, as shown on its card. `at` is when we last tried (null = never). */
export interface VaultEstimate {
  low: number | null;
  median: number | null;
  high: number | null;
  confidence: string | null;
  at: string | null;
}

/** Re-price a riven when its estimate is older than this (the market cache is 12 minutes; this keeps the page cheap). */
export const STALE_AFTER_MS = 60 * 60 * 1000;

export const needsRefresh = (e: VaultEstimate | undefined, now = Date.now()): boolean =>
  !e || !e.at || !(now - Date.parse(e.at) < STALE_AFTER_MS);

export interface VaultTotals {
  median: number;
  low: number;
  high: number;
  /** Rivens with an estimate / all rivens. */
  priced: number;
  total: number;
}

/** Sum of the individual estimates across the vault. Rivens without an estimate simply don't contribute. */
export function vaultTotals(ids: string[], est: Record<string, VaultEstimate | undefined>): VaultTotals {
  let median = 0, low = 0, high = 0, priced = 0;
  for (const id of ids) {
    const e = est[id];
    if (e?.median == null) continue;
    median += e.median; low += e.low ?? e.median; high += e.high ?? e.median; priced++;
  }
  return { median, low, high, priced, total: ids.length };
}
