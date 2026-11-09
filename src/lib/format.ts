import type { RivenAttribute } from "@/lib/types";

/** "+112.3%" / "-45.0%" / "+2.1s" / "x1.3" — always signed for stats. */
export function fmtStat(value: number, unit: string | null | undefined): string {
  const sign = value < 0 ? "-" : "+";
  const abs = Math.abs(value);
  const n = String(Number(abs.toFixed(unit === "multiply" ? 2 : 1)));
  if (unit === "percent") return `${sign}${n}%`;
  if (unit === "seconds") return `${sign}${n}s`;
  if (unit === "multiply") return `x${n}`;
  return `${sign}${n}`;
}

export function unitSuffix(attr: RivenAttribute | undefined): string {
  if (!attr) return "";
  return attr.unit === "percent" ? "%" : attr.unit === "seconds" ? "s" : "";
}

export function timeAgo(iso: string | Date): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
