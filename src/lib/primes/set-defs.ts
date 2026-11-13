import type { SetDef } from "./combine-sets";
import type { PrimePart } from "./types";

/** Every Prime set with the parts (and how many of each) it takes — a compact list to hand to the browser. */
export function setDefs(parts: PrimePart[]): SetDef[] {
  const bySet = new Map<string, PrimePart[]>();
  for (const p of parts) if (p.kind === "part" && p.setSlug) bySet.set(p.setSlug, [...(bySet.get(p.setSlug) ?? []), p]);
  return parts.filter((p) => p.kind === "set" && bySet.has(p.slug)).map((s) => ({ slug: s.slug, name: s.name, parts: bySet.get(s.slug)!.map((p) => ({ slug: p.slug, perSet: p.perSet })) }));
}
