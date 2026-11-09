/** Rarity chip colours. Plain module (no "use client") so server and client components can both use it. */
export const rarityClass = (r: string | null) =>
  r === "Legendary" ? "border-orange/50 text-orange" : r === "Rare" ? "border-violet/50 text-violet" : r === "Uncommon" ? "border-teal/50 text-teal" : "";
