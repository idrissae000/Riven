export interface BasketItem { name: string; ducats: number; credits: number; /** projected platinum you'd get for it at the chosen hold time */ value: number }
export interface Basket { items: BasketItem[]; ducats: number; credits: number; value: number }

const BRUTE_LIMIT = 18;

/**
 * The set of items (one of each — Baro sells a single unit) worth the most platinum that fits within the ducats and credits you have.
 * `null` for a budget means no limit on that currency. Exact for up to 18 items (every combination); beyond that a value-per-ducat greedy fill.
 */
export function bestBasket(all: BasketItem[], budget: { ducats: number | null; credits: number | null }): Basket {
  const items = all.filter((i) => i.value > 0);
  const fits = (d: number, c: number) => (budget.ducats == null || d <= budget.ducats) && (budget.credits == null || c <= budget.credits);
  const pack = (chosen: BasketItem[]): Basket => ({ items: chosen, ducats: chosen.reduce((s, i) => s + i.ducats, 0), credits: chosen.reduce((s, i) => s + i.credits, 0), value: Math.round(chosen.reduce((s, i) => s + i.value, 0) * 10) / 10 });

  if (items.length > BRUTE_LIMIT) {
    const chosen: BasketItem[] = [];
    let d = 0, c = 0;
    for (const i of [...items].sort((a, b) => b.value / Math.max(1, b.ducats) - a.value / Math.max(1, a.ducats))) {
      if (fits(d + i.ducats, c + i.credits)) { chosen.push(i); d += i.ducats; c += i.credits; }
    }
    return pack(chosen);
  }

  let best: { mask: number; value: number; ducats: number } = { mask: 0, value: 0, ducats: 0 };
  for (let mask = 1; mask < 1 << items.length; mask++) {
    let d = 0, c = 0, v = 0;
    for (let i = 0; i < items.length; i++) if (mask & (1 << i)) { d += items[i].ducats; c += items[i].credits; v += items[i].value; }
    if (!fits(d, c)) continue;
    if (v > best.value + 1e-9 || (Math.abs(v - best.value) <= 1e-9 && d < best.ducats)) best = { mask, value: v, ducats: d };
  }
  return pack(items.filter((_, i) => best.mask & (1 << i)));
}
