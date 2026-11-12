/** Ducats per platinum at or above which a part is better handed to Baro Ki'Teer than sold (e.g. a 45-ducat part worth ≤ 4.5p). */
export const DUCAT_RATIO = 10;

export type DucatVerdict = "ducat" | "sell";

/**
 * Sell it for platinum, or turn it into ducats? Ducats can't be traded, so this is a judgement: below ~1 plat per 10 ducats
 * the platinum is worth less than the ducats it would have bought. Null when there's no price or no ducat value to compare.
 */
export function ducatVerdict(price: number | null, ducats: number | null): DucatVerdict | null {
  if (price == null || price <= 0 || !ducats) return null;
  return ducats / price >= DUCAT_RATIO ? "ducat" : "sell";
}
