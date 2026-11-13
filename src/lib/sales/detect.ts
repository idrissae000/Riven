export interface OrderSnap { orderId: string; slug: string; name: string; rank: number; qty: number; price: number }
export interface SaleCandidate { orderId: string; slug: string; name: string; qty: number; priceEach: number }

/**
 * Probable sales between two looks at a user's sell orders: an order that vanished (all of it sold — or they removed it) or whose
 * quantity went down (that many sold — or they lowered it). Sold at the price we last saw. These are only CANDIDATES: the user confirms.
 */
export function detectSales(prev: OrderSnap[], now: OrderSnap[]): SaleCandidate[] {
  const cur = new Map(now.map((o) => [o.orderId, o]));
  const out: SaleCandidate[] = [];
  for (const p of prev) {
    const c = cur.get(p.orderId);
    const sold = c ? p.qty - c.qty : p.qty;
    if (sold > 0) out.push({ orderId: p.orderId, slug: p.slug, name: p.rank > 0 ? `${p.name} (rank ${p.rank})` : p.name, qty: sold, priceEach: p.price });
  }
  return out;
}

export interface SaleRow { id: string; item_name: string; qty: number; price_each: number; sold_at: string; status: string }

const DAY = 86_400_000;
export interface SalesSummary {
  week: number; month: number; all: number; count: number;
  /** Platinum per week for the last 8 weeks, oldest first (the last is the week ending now). */
  weekly: { start: string; plat: number }[];
  top: { name: string; plat: number; units: number }[];
}

/** Totals for confirmed sales only. `now` is passed in so it stays testable. */
export function summarizeSales(rows: SaleRow[], now: number): SalesSummary {
  const sales = rows.filter((r) => r.status === "confirmed");
  const total = (r: SaleRow) => r.qty * r.price_each;
  const within = (days: number) => sales.filter((r) => now - Date.parse(r.sold_at) < days * DAY).reduce((s, r) => s + total(r), 0);
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const hi = now - (7 - i) * 7 * DAY, lo = hi - 7 * DAY;
    return { start: new Date(lo).toISOString().slice(0, 10), plat: sales.filter((r) => { const t = Date.parse(r.sold_at); return t > lo && t <= hi; }).reduce((s, r) => s + total(r), 0) };
  });
  weekly[7].plat += sales.filter((r) => Date.parse(r.sold_at) > now).reduce((s, r) => s + total(r), 0); // anything stamped slightly in the future counts as now
  const byItem = new Map<string, { plat: number; units: number }>();
  for (const r of sales) { const e = byItem.get(r.item_name) ?? { plat: 0, units: 0 }; e.plat += total(r); e.units += r.qty; byItem.set(r.item_name, e); }
  return {
    week: within(7), month: within(30), all: sales.reduce((s, r) => s + total(r), 0), count: sales.length, weekly,
    top: [...byItem.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.plat - a.plat).slice(0, 5),
  };
}
