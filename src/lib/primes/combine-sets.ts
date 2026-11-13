export interface SetDef { slug: string; name: string; parts: { slug: string; perSet: number }[] }
export interface CombinableRow { key: string; kind: "prime" | "arcane"; slug: string; rank: number; name: string; qty: number; unit: number | null; ducats: number | null }

export interface Combined<T extends CombinableRow> {
  rows: T[];
  /** What was combined: the set, how many copies, and the platinum gained over selling the loose parts. */
  sets: { slug: string; name: string; copies: number; gain: number }[];
}

/**
 * Replaces complete sets among the rows with a set order. For every Prime set whose parts you own in full (counting parts the
 * set needs twice), it takes out the parts and adds the set — but only when the set sells for MORE than those parts do
 * (`setPrice` per set vs the parts' own unit prices); otherwise the parts stay as they are. Spare parts stay as loose rows.
 */
export function combineSets<T extends CombinableRow>(rows: T[], sets: SetDef[], setPrice: (slug: string) => number | null, make: (set: SetDef, copies: number, unit: number) => T): Combined<T> {
  const left = new Map<string, number>();
  const unit = new Map<string, number | null>();
  for (const r of rows) if (r.kind === "prime" && r.rank === 0) { left.set(r.slug, (left.get(r.slug) ?? 0) + r.qty); unit.set(r.slug, r.unit); }

  const made: { set: SetDef; copies: number; price: number; gain: number }[] = [];
  for (const set of sets) {
    const price = setPrice(set.slug);
    if (price == null || !set.parts.length) continue;
    if (set.parts.some((p) => unit.get(p.slug) == null)) continue; // every part needs a known price to compare
    const copies = Math.min(...set.parts.map((p) => Math.floor((left.get(p.slug) ?? 0) / p.perSet)));
    if (copies < 1) continue;
    const partsValue = set.parts.reduce((s, p) => s + p.perSet * (unit.get(p.slug) as number), 0);
    const gain = (price - partsValue) * copies;
    if (gain <= 0) continue;
    for (const p of set.parts) left.set(p.slug, (left.get(p.slug) ?? 0) - p.perSet * copies);
    made.push({ set, copies, price, gain: Math.round(gain * 10) / 10 });
  }
  if (!made.length) return { rows, sets: [] };

  const out: T[] = [];
  for (const r of rows) {
    if (r.kind !== "prime" || r.rank !== 0 || !made.some((m) => m.set.parts.some((p) => p.slug === r.slug))) { out.push(r); continue; }
    const remaining = left.get(r.slug) ?? 0;
    left.set(r.slug, 0); // a part appearing in two rows is only counted once
    if (remaining > 0) out.push({ ...r, qty: remaining });
  }
  const setRows = made.map((m) => make(m.set, m.copies, m.price));
  return { rows: [...setRows, ...out], sets: made.map((m) => ({ slug: m.set.slug, name: m.set.name, copies: m.copies, gain: m.gain })) };
}
