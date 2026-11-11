/** Rarity chip colours. Plain module (no "use client") so server and client components can both use it. */
export const rarityClass = (r: string | null) =>
  r === "Legendary" ? "border-orange/50 text-orange" : r === "Rare" ? "border-violet/50 text-violet" : r === "Uncommon" ? "border-teal/50 text-teal" : "";

/** Rarity as plain coloured text (for cards, where a boxed chip is too busy). */
export const rarityText = (r: string | null) =>
  r === "Legendary" ? "font-semibold text-orange" : r === "Rare" ? "font-semibold text-violet" : r === "Uncommon" ? "font-semibold text-teal" : "font-semibold text-dim";
