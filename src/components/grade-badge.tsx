import type { Tier } from "@/lib/grading/config";

const STYLE: Record<Tier, string> = {
  S: "border-grade-s/70 bg-grade-s/15 text-grade-s shadow-[0_0_14px_-2px_var(--color-grade-s)]",
  A: "border-grade-a/60 bg-grade-a/15 text-grade-a",
  B: "border-grade-b/60 bg-grade-b/15 text-grade-b",
  C: "border-grade-c/60 bg-grade-c/15 text-grade-c",
  D: "border-grade-d/60 bg-grade-d/15 text-grade-d",
  F: "border-grade-f/60 bg-grade-f/15 text-grade-f",
};
const BAR: Record<Tier, string> = {
  S: "bg-grade-s", A: "bg-grade-a", B: "bg-grade-b", C: "bg-grade-c", D: "bg-grade-d", F: "bg-grade-f",
};
export const barClass = (t: Tier) => BAR[t];

export function GradeBadge({ tier, placeholder = false, size = "md" }: { tier: Tier | null; placeholder?: boolean; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "size-6 text-sm" : "size-10 text-xl";
  if (!tier)
    return <span title="No range data yet" className={`h-display inline-flex ${dims} shrink-0 items-center justify-center rounded-md border border-dashed border-line text-dim`}>–</span>;
  return (
    <span
      title={placeholder ? `Grade ${tier} (placeholder range)` : `Grade ${tier}`}
      className={`h-display relative inline-flex ${dims} shrink-0 items-center justify-center rounded-md border ${STYLE[tier]} ${placeholder ? "border-dashed" : ""}`}
    >
      {tier}
      {placeholder && <span aria-hidden className="absolute -right-1 -top-1 text-[10px] leading-none text-orange">*</span>}
    </span>
  );
}
