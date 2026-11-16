import type { SalesDay } from "@/lib/history-sales";

const DAY = 86_400_000;
const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

export type Liquidity = "fast" | "steady" | "slow" | "stuck" | "unknown";

/** How many units of an item the whole market sells per day: complete days only (today is partial), over the last `window` days. */
export function marketSpeed(sales: SalesDay[], now: number, window = 14): { perDay: number | null; liquidity: Liquidity } {
  const today = dayKey(now), from = dayKey(now - window * DAY);
  const rows = sales.filter((s) => s.day >= from && s.day < today);
  if (!rows.length || !sales.length) return { perDay: null, liquidity: "unknown" };
  const first = sales[0].day;
  const covered = Math.min(window, Math.max(1, Math.round((Date.parse(today) - Date.parse(first < from ? from : first)) / DAY)));
  const perDay = Math.round((rows.reduce((s, r) => s + r.volume, 0) / covered) * 10) / 10;
  return { perDay, liquidity: perDay >= 5 ? "fast" : perDay >= 1 ? "steady" : perDay >= 0.25 ? "slow" : "stuck" };
}

/** Sold-price change: the average of the last 7 complete days against the 7 before them (%, null without both). */
export function priceChange7d(sales: SalesDay[], now: number): number | null {
  const today = dayKey(now), a = dayKey(now - 7 * DAY), b = dayKey(now - 14 * DAY);
  const avg = (rows: SalesDay[]) => { const v = rows.reduce((s, r) => s + r.volume, 0); return v > 0 ? rows.reduce((s, r) => s + r.avg * r.volume, 0) / v : null; };
  const recent = avg(sales.filter((s) => s.day >= a && s.day < today)), before = avg(sales.filter((s) => s.day >= b && s.day < a));
  return recent != null && before != null && before > 0 ? Math.round(((recent - before) / before) * 1000) / 10 : null;
}

export interface Holding { key: string; name: string; value: number; kind: "part" | "arcane" | "riven"; liquidity: Liquidity }

/** Where the value sits: shares by kind, the biggest holdings, and plat tied up in items that sell slowly. */
export function allocation(holdings: Holding[]) {
  const total = holdings.reduce((s, h) => s + h.value, 0);
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);
  const by = (k: Holding["kind"]) => holdings.filter((h) => h.kind === k).reduce((s, h) => s + h.value, 0);
  const sorted = [...holdings].sort((a, b) => b.value - a.value);
  const stuck = holdings.filter((h) => h.liquidity === "slow" || h.liquidity === "stuck").reduce((s, h) => s + h.value, 0);
  return {
    total, parts: pct(by("part")), arcanes: pct(by("arcane")), rivens: pct(by("riven")),
    top: sorted.slice(0, 5).map((h) => ({ ...h, share: pct(h.value) })),
    top3: pct(sorted.slice(0, 3).reduce((s, h) => s + h.value, 0)),
    slowValue: Math.round(stuck), slowShare: pct(stuck),
  };
}

export interface Sale { item_name: string; qty: number; price_each: number; cost_each: number | null; sold_at: string; status: string }

/** Profit from confirmed sales: revenue, the cost you entered, and profit on the sales that have a cost. */
export function profit(sales: Sale[], now: number, days?: number) {
  const rows = sales.filter((s) => s.status === "confirmed" && (days == null || now - Date.parse(s.sold_at) < days * DAY));
  const revenue = rows.reduce((s, r) => s + r.qty * r.price_each, 0);
  const costed = rows.filter((r) => r.cost_each != null);
  const cost = costed.reduce((s, r) => s + r.qty * (r.cost_each as number), 0);
  const costedRevenue = costed.reduce((s, r) => s + r.qty * r.price_each, 0);
  return { revenue, units: rows.reduce((s, r) => s + r.qty, 0), cost, profit: costedRevenue - cost, costedShare: rows.length ? Math.round((costed.length / rows.length) * 100) : 0, margin: cost > 0 ? Math.round(((costedRevenue - cost) / cost) * 100) : null };
}

/** Sales compared with the market: for each sold item with a current price, were you selling above or below it? */
export function vsMarket(sales: Sale[], priceBySlugName: (name: string) => number | null) {
  const by = new Map<string, { plat: number; units: number }>();
  for (const s of sales) if (s.status === "confirmed") { const e = by.get(s.item_name) ?? { plat: 0, units: 0 }; e.plat += s.qty * s.price_each; e.units += s.qty; by.set(s.item_name, e); }
  return [...by.entries()].flatMap(([name, e]) => {
    const now = priceBySlugName(name);
    return now ? [{ name, soldAvg: Math.round((e.plat / e.units) * 10) / 10, now, diffPct: Math.round(((e.plat / e.units - now) / now) * 1000) / 10, units: e.units }] : [];
  }).sort((a, b) => b.units - a.units);
}

export interface HoldingRow { name: string; value: number; share: number; change7d: number | null; liquidity: Liquidity; perDay: number | null }

/** Plain-language observations about the portfolio, most useful first. */
export function insights(rows: HoldingRow[], alloc: ReturnType<typeof allocation>): string[] {
  const out: string[] = [];
  const big = rows[0];
  if (big && big.share >= 35 && rows.length > 1) out.push(`${big.name} is ${big.share}% of everything you hold. One price drop there moves your whole portfolio — consider selling part of it.`);
  else if (alloc.top3 >= 65 && rows.length > 3) out.push(`Your top 3 holdings are ${alloc.top3}% of the value. It’s concentrated: a dip in any of them hurts.`);
  if (alloc.slowShare >= 20) out.push(`${alloc.slowValue}p (${alloc.slowShare}%) is sitting in items that sell less than once a day across the whole market. Money in slow items takes a long time to turn back into platinum.`);
  const up = rows.filter((r) => r.change7d != null && r.change7d >= 10 && r.value >= 10).sort((a, b) => b.value - a.value).slice(0, 3);
  if (up.length) out.push(`Up this week: ${up.map((r) => `${r.name} (+${r.change7d}%)`).join(", ")}. Prices that jump often fall back — a good moment to sell into strength.`);
  const down = rows.filter((r) => r.change7d != null && r.change7d <= -10 && r.value >= 10).sort((a, b) => b.value - a.value).slice(0, 3);
  if (down.length) out.push(`Down this week: ${down.map((r) => `${r.name} (${r.change7d}%)`).join(", ")}. If they’re fast sellers they often recover; slow ones may not.`);
  const fast = rows.filter((r) => r.liquidity === "fast").reduce((s, r) => s + r.value, 0);
  if (alloc.total > 0 && fast / alloc.total >= 0.6) out.push(`${Math.round((fast / alloc.total) * 100)}% of your value is in items that sell 5+ a day. You could turn most of it into platinum within days.`);
  return out;
}
