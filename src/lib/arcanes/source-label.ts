import type { DropSource } from "@/lib/wiki/wikitext";

const VERB: Record<string, string> = { vendor: "Buy", reward: "Reward", drop: "Drop" };

/** A short "where to get it" for a card, from the arcane's first wiki source: "Buy: The Quills", "Reward: Eidolon Hydrolyst". */
export function sourceLabel(sources: DropSource[] | null | undefined): string | null {
  for (const s of sources ?? []) {
    const link = s.links?.[0];
    if (!link) continue;
    const name = link.split("/")[0].replace(/\s*\(.*?\)\s*/g, " ").trim();
    if (!name) continue;
    const verb = VERB[s.kind];
    return verb ? `${verb}: ${name}` : name;
  }
  return null;
}
