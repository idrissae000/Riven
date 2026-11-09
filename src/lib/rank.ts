/**
 * Riven stat values scale linearly with rank: a rank-r riven shows (r+1)/9 of its
 * rank-8 (max) value. (Consistent with the wiki's rank-8 base values and live
 * Warframe Market listings, which are often posted unranked.)
 *
 * To compare rivens fairly — and to grade a roll against min/max ranges that are
 * defined at max rank — every value is normalised to rank 8 first.
 *
 * "multiply" stats (e.g. Damage vs Infested, shown as x1.45) scale the part above
 * x1, i.e. (value - 1).
 */
export const MAX_RANK = 8;

export function toMaxRank(value: number, rank: number, unit: string | null | undefined): number {
  const factor = (MAX_RANK + 1) / (Math.min(Math.max(rank, 0), MAX_RANK) + 1);
  if (unit === "multiply") return 1 + (value - 1) * factor;
  return value * factor;
}
