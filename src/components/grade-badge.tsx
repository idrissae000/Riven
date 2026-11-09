import type { CSSProperties } from "react";
import type { Tier } from "@/lib/grading/config";

const COLOR: Record<Tier, string> = {
  S: "var(--color-grade-s)", A: "var(--color-grade-a)", B: "var(--color-grade-b)",
  C: "var(--color-grade-c)", D: "var(--color-grade-d)", F: "var(--color-grade-f)",
};
export const tierColor = (t: Tier) => COLOR[t];

/** Hexagonal tier badge. S glows and slowly pulses. A "*" pip marks a grade built on placeholder ranges. */
export function GradeBadge({ tier, placeholder = false, size = "md" }: { tier: Tier | null; placeholder?: boolean; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "hex-sm" : "hex-md";
  if (!tier)
    return (
      <span title="No range data yet" className={`hex-wrap`} style={{ "--tier": "var(--color-line-2)", filter: "none" } as CSSProperties}>
        <span className={`hex ${dims}`}><span>–</span></span>
      </span>
    );
  return (
    <span className="hex-wrap relative" data-tier={tier} style={{ "--tier": COLOR[tier] } as CSSProperties} title={placeholder ? `Grade ${tier} (placeholder range)` : `Grade ${tier}`}>
      <span className={`hex ${dims}`}><span>{tier}</span></span>
      {placeholder && <span aria-hidden className="absolute -right-0.5 -top-1 font-display text-xs leading-none text-orange">*</span>}
    </span>
  );
}
