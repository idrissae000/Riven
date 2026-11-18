import { repriceSellOrder, repricedValue, type RepriceRule } from "@/lib/wfm/reprice";
import type { Listing } from "@/lib/wfm/listings";

export interface AutoSettings { rule: RepriceRule; floor: number; maxDropPct: number; /** also raise a price when the cheapest seller raises theirs */ followUp?: boolean; /** the most it may ever raise a price to (needed for followUp) */ ceiling?: number | null }
export interface AutoOrder { id: string; platinum: number; visible: boolean; type: "sell" | "buy"; updatedAt: string | null }

/** After changing an order, leave it alone this long (so two bots can't chase each other down every minute). */
export const COOLDOWN_MS = 10 * 60_000;
export const MIN_OTHER_SELLERS = 2;

export type AutoPlan = { action: "change"; to: number; cheapest: number; note: string | null; direction: "down" | "up" } | { action: "skip"; why: "not-sell" | "hidden" | "cooldown" | "thin-market" | "not-undercut" | "at-floor" | "at-ceiling" | "no-change" };

/**
 * Decides whether to move one sell order. It LOWERS a price you've been undercut on (to match / undercut the cheapest, never below your floor), and, only if
 * "follow up" is on, RAISES it again when the cheapest seller goes up (never above your ceiling). It only acts when the order is visible, hasn't changed in
 * the last 10 minutes, and at least 2 other online sellers set the market (one lone listing isn't a market). One step moves a price by at most `maxDropPct`.
 */
export function planAutoprice(order: AutoOrder, market: Listing[], mine: string | null, s: AutoSettings, now: number): AutoPlan {
  if (order.type !== "sell") return { action: "skip", why: "not-sell" };
  if (!order.visible) return { action: "skip", why: "hidden" };
  if (order.updatedAt && now - Date.parse(order.updatedAt) < COOLDOWN_MS) return { action: "skip", why: "cooldown" };
  const others = market.filter((l) => !mine || l.seller.toLowerCase() !== mine.toLowerCase());
  if (others.length < MIN_OTHER_SELLERS) return { action: "skip", why: "thin-market" };
  const r = repriceSellOrder(order.platinum, others, mine, s.rule, s.floor);
  if (r.target == null) return { action: "skip", why: "thin-market" };
  const cheapest = r.cheapest as number;

  if (r.status === "undercut") {
    if (order.platinum <= s.floor) return { action: "skip", why: "at-floor" };
    let to = repricedValue(order.platinum, r);
    if (to == null) return { action: "skip", why: "no-change" };
    let note: string | null = null;
    const lowest = Math.ceil(order.platinum * (1 - s.maxDropPct / 100));
    if (to < lowest) { to = Math.max(lowest, s.floor); note = `capped at a ${s.maxDropPct}% drop per step`; }
    return to >= order.platinum ? { action: "skip", why: "no-change" } : { action: "change", to, cheapest, note, direction: "down" };
  }

  if (s.followUp && r.target > order.platinum) {
    const ceiling = s.ceiling ?? null;
    if (ceiling == null) return { action: "skip", why: "at-ceiling" };
    if (order.platinum >= ceiling) return { action: "skip", why: "at-ceiling" };
    let to = Math.min(r.target, ceiling);
    let note: string | null = null;
    const highest = Math.floor(order.platinum * (1 + s.maxDropPct / 100));
    if (to > highest) { to = Math.max(highest, order.platinum + 1); note = `capped at a ${s.maxDropPct}% rise per step`; }
    if (to > ceiling) to = ceiling;
    return to > order.platinum ? { action: "change", to, cheapest, note, direction: "up" } : { action: "skip", why: "no-change" };
  }
  return { action: "skip", why: "not-undercut" };
}
