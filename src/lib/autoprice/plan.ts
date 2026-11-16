import { repriceSellOrder, repricedValue, type RepriceRule } from "@/lib/wfm/reprice";
import type { Listing } from "@/lib/wfm/listings";

export interface AutoSettings { rule: RepriceRule; floor: number; maxDropPct: number }
export interface AutoOrder { id: string; platinum: number; visible: boolean; type: "sell" | "buy"; updatedAt: string | null }

export const COOLDOWN_MS = 60 * 60_000;
export const MIN_OTHER_SELLERS = 2;

export type AutoPlan = { action: "change"; to: number; cheapest: number; note: string | null } | { action: "skip"; why: "not-sell" | "hidden" | "cooldown" | "thin-market" | "not-undercut" | "at-floor" | "no-change" };

/**
 * Decides whether to lower one sell order. The only thing it ever does is LOWER a price you've been undercut on, and only when:
 * the order is visible, it hasn't changed in the last hour, at least 2 other online sellers set the market (one lone cheap listing isn't a market),
 * and the new price is not below your floor. A single step never drops more than `maxDropPct` of the current price.
 */
export function planAutoprice(order: AutoOrder, market: Listing[], mine: string | null, s: AutoSettings, now: number): AutoPlan {
  if (order.type !== "sell") return { action: "skip", why: "not-sell" };
  if (!order.visible) return { action: "skip", why: "hidden" };
  if (order.updatedAt && now - Date.parse(order.updatedAt) < COOLDOWN_MS) return { action: "skip", why: "cooldown" };
  const others = market.filter((l) => !mine || l.seller.toLowerCase() !== mine.toLowerCase());
  if (others.length < MIN_OTHER_SELLERS) return { action: "skip", why: "thin-market" };
  const r = repriceSellOrder(order.platinum, others, mine, s.rule, s.floor);
  if (r.status !== "undercut") return { action: "skip", why: "not-undercut" };
  if (order.platinum <= s.floor) return { action: "skip", why: "at-floor" };
  let to = repricedValue(order.platinum, r);
  if (to == null) return { action: "skip", why: "no-change" };
  let note: string | null = null;
  const lowest = Math.ceil(order.platinum * (1 - s.maxDropPct / 100));
  if (to < lowest) { to = Math.max(lowest, s.floor); note = `capped at a ${s.maxDropPct}% drop per step`; }
  if (to >= order.platinum) return { action: "skip", why: "no-change" };
  return { action: "change", to, cheapest: r.cheapest as number, note };
}
