import type { CSSProperties } from "react";
import { gradeGroup, type Tier } from "@/lib/grading/config";

const GROUP_COLOR = {
  S: "var(--color-grade-s)", A: "var(--color-grade-a)", B: "var(--color-grade-b)", C: "var(--color-grade-c)", D: "var(--color-grade-d)", F: "var(--color-grade-f)",
} as const;
export const tierColor = (t: Tier) => GROUP_COLOR[gradeGroup(t)];

/** Hexagonal grade badge (S, A+, A, A-, B+, … F). S glows and slowly pulses; colour follows the letter. */
export function GradeBadge({ tier, size = "md" }: { tier: Tier | null; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "hex-sm" : "hex-md";
  if (!tier)
    return (
      <span title="Can’t be graded yet" className="hex-wrap" style={{ "--tier": "var(--color-line-2)", filter: "none" } as CSSProperties}>
        <span className={`hex ${dims}`}><span>–</span></span>
      </span>
    );
  return (
    <span className="hex-wrap" data-tier={tier} style={{ "--tier": tierColor(tier) } as CSSProperties} title={`Grade ${tier}`}>
      <span className={`hex ${dims} ${tier.length > 1 ? "hex-long" : ""}`}><span>{tier}</span></span>
    </span>
  );
}
