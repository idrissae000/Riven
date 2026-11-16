import type { PrimePart, Relic } from "@/lib/primes/types";
import { relicValue } from "@/lib/primes/relic-value";

const ERAS = ["Lith", "Meso", "Neo", "Axi"] as const;
export type Era = (typeof ERAS)[number];
/** Relic refinements by pack colour. */
const REFINE: Record<string, "intact" | "exceptional" | "flawless" | "radiant"> = { Bronze: "intact", Silver: "exceptional", Gold: "flawless", Platinum: "radiant" };

export interface RelicPack { tier: number; era: Era; frames: string[]; vault: string; colour: string; refinement: "intact" | "exceptional" | "flawless" | "radiant" }

/** "T2 Void Projection Nidus Saryn Vault A Bronze" → Meso relics of the Nidus and Saryn vault, in Bronze (Intact). Null for anything else Varzia sells. */
export function parseRelicPack(item: string): RelicPack | null {
  const m = /^T([1-4]) Void Projection (.+?) Vault ([A-Z]) (Bronze|Silver|Gold|Platinum)$/i.exec(item.trim());
  if (!m) return null;
  const colour = m[4][0].toUpperCase() + m[4].slice(1).toLowerCase();
  return { tier: Number(m[1]), era: ERAS[Number(m[1]) - 1], frames: m[2].split(/\s+/), vault: m[3].toUpperCase(), colour, refinement: REFINE[colour] };
}

/** Every relic of an era that drops a part of one of these frames' Primes (those are the vault's relics). */
export function relicPool(relics: Relic[], parts: PrimePart[], era: Era, frames: string[]): Relic[] {
  const name = new Map(parts.map((p) => [p.slug, p.name]));
  const wanted = frames.map((f) => `${f === "Infestation" ? "Nidus" : f} Prime `.toLowerCase());
  return relics.filter((r) => r.era === era && [...r.common, ...r.uncommon, r.rare].some((s) => { const n = s ? name.get(s)?.toLowerCase() : null; return n != null && wanted.some((w) => n.startsWith(w)); }));
}

export interface PoolRelic { name: string; ev: number; best: { name: string; price: number } | null; unpriced: number }

/** Each relic of the pool valued at the pack's refinement: the average platinum of what it can open to. `priceOf` is null for unknown or thin markets. */
export function valuePool(pool: Relic[], parts: PrimePart[], refinement: RelicPack["refinement"], priceOf: (slug: string) => number | null): { relics: PoolRelic[]; avg: number | null } {
  const name = new Map(parts.map((p) => [p.slug, p.name]));
  const relics = pool.map((r): PoolRelic => {
    const v = relicValue(r, priceOf);
    const priced = v.drops.filter((d) => d.slug && d.price != null && d.price > 0).sort((a, b) => (b.price as number) - (a.price as number))[0];
    return { name: r.name, ev: v.ev[refinement], best: priced ? { name: name.get(priced.slug as string) ?? (priced.slug as string), price: priced.price as number } : null, unpriced: v.unpriced };
  }).sort((a, b) => b.ev - a.ev);
  return { relics, avg: relics.length ? Math.round((relics.reduce((s, r) => s + r.ev, 0) / relics.length) * 10) / 10 : null };
}
