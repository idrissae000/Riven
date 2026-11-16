import type { Liquidity } from "./metrics";

export type Signal = "sell" | "trim" | "hold" | "buy-more" | "dump" | "none";

export interface SignalInput {
  /** Asking price now ÷ the item's normal ask - 1, in % (positive = pricier than usual). Null without a 30-day record. */
  premiumPct: number | null;
  /** Selling prices over the last 3 days vs the 3 before, in % (null if unknown). */
  momentumPct: number | null;
  liquidity: Liquidity;
  /** Share of the whole portfolio, in %. */
  sharePct: number;
}
export interface SignalOut { signal: Signal; reasons: string[] }

export const SIGNAL_LABEL: Record<Signal, string> = { sell: "Sell now", trim: "Trim", hold: "Hold", "buy-more": "Hold — cheap", dump: "Get out", none: "—" };

/**
 * A transparent rule set (not a prediction): sell strength, don't sell weakness in things that sell fast, and get out of slow things that are sinking.
 *  - Get out: sells slowly AND is below its normal price AND still falling. Waiting costs time and the price is going the wrong way.
 *  - Sell now: 10%+ above its normal price. Prices this far above usual have tended to drift back (see the Insights back-test for the matching dip data).
 *  - Hold — cheap: 10%+ below normal and sells at least steadily. A fast seller below normal tends to recover, so don't sell it at a discount.
 *  - Trim: it's 35%+ of your portfolio, whatever else is true.
 *  - Otherwise hold.
 */
export function signalFor(i: SignalInput): SignalOut {
  if (i.premiumPct == null) return { signal: "none", reasons: ["No 30-day record to compare with."] };
  const reasons: string[] = [];
  const slow = i.liquidity === "slow" || i.liquidity === "stuck";
  const falling = i.momentumPct != null && i.momentumPct <= -3;
  const rising = i.momentumPct != null && i.momentumPct >= 3;

  if (slow && i.premiumPct <= -5 && falling) return { signal: "dump", reasons: [`Sells slowly, is ${Math.abs(i.premiumPct)}% under its normal price and still falling (${i.momentumPct}% in 3 days).`] };
  if (i.premiumPct >= 10) {
    reasons.push(`${i.premiumPct}% above its normal price.`);
    if (falling) reasons.push("Selling prices are already turning down.");
    if (slow) reasons.push("It sells slowly, so list it soon.");
    return { signal: "sell", reasons };
  }
  if (i.sharePct >= 35) return { signal: "trim", reasons: [`It’s ${i.sharePct}% of your portfolio — a drop here moves everything.`] };
  if (i.premiumPct <= -10 && (i.liquidity === "fast" || i.liquidity === "steady")) {
    return { signal: "buy-more", reasons: [`${Math.abs(i.premiumPct)}% under its normal price and it sells at least steadily — don’t sell it cheap.${rising ? " Prices are already picking up." : ""}`] };
  }
  reasons.push(Math.abs(i.premiumPct) < 5 ? "Priced about where it normally is." : `${i.premiumPct > 0 ? "A bit above" : "A bit below"} its normal price.`);
  return { signal: "hold", reasons };
}
