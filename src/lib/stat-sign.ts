import type { RivenAttribute, RivenStat } from "@/lib/types";

type SignAttr = Pick<RivenAttribute, "unit" | "inverted" | "positive_only"> | undefined;

/**
 * Role (is the curse?) and numeric sign are different things:
 *  - normal stats:   bonus = positive value, curse = negative value
 *  - inverted stats: (Weapon Recoil) bonus = NEGATIVE value, curse = positive value
 *  - "multiply" stats (Damage vs Faction) are multipliers; users type the displayed
 *    xN.NN value directly and no sign is involved.
 */
export function negativeSign(attr: SignAttr, isCurse: boolean): boolean {
  return isCurse !== !!attr?.inverted;
}

/** Prefix shown in front of the typed magnitude in the form. */
export function signPrefix(attr: SignAttr, isCurse: boolean): "+" | "−" | "x" {
  if (attr?.unit === "multiply") return "x";
  return negativeSign(attr, isCurse) ? "−" : "+";
}

/** Typed magnitude -> stored (signed, as displayed in game). */
export function toStoredValue(attr: SignAttr, isCurse: boolean, typed: number): number {
  if (attr?.unit === "multiply") return typed;
  return (negativeSign(attr, isCurse) ? -1 : 1) * Math.abs(typed);
}

/** Stored -> what to put in the form input. */
export function toTypedValue(attr: SignAttr, stored: number): number {
  return attr?.unit === "multiply" ? stored : Math.abs(stored);
}

/** Server-side sanity check of a riven's stats against attribute definitions. */
export function validateStatSigns(stats: RivenStat[], attrs: Map<string, NonNullable<SignAttr> & { name?: string }>): string | null {
  for (const s of stats) {
    const a = attrs.get(s.stat);
    if (!a) return `Unknown stat “${s.stat}”`;
    if (s.is_negative && a.positive_only) return `${a.name ?? s.stat} can’t be a negative stat`;
    if (a.unit !== "multiply" && s.value !== 0 && (s.value < 0) !== negativeSign(a, s.is_negative)) {
      return `${a.name ?? s.stat}: value sign doesn’t match its role as a ${s.is_negative ? "negative" : "positive"} stat`;
    }
  }
  return null;
}
