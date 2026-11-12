import type { Trend } from "@/lib/history";

/** A tiny price chart plus the 7-day move, e.g. "▲ 40% 7d". Renders nothing until there are two days of history. */
export function TrendBadge({ trend }: { trend: Trend | null | undefined }) {
  if (!trend) return null;
  const { prices, dir, changePct, days } = trend;
  const lo = Math.min(...prices), hi = Math.max(...prices), span = hi - lo || 1;
  const W = 56, H = 18;
  const pts = prices.map((p, i) => `${((i / (prices.length - 1)) * W).toFixed(1)},${(H - 2 - ((p - lo) / span) * (H - 4)).toFixed(1)}`).join(" ");
  const color = dir === "up" ? "text-ok" : dir === "down" ? "text-danger" : "text-dim";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${color}`} title={`Price over the last ${prices.length} days we’ve tracked`}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="overflow-visible"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
      <span>{dir === "flat" ? "flat" : `${dir === "up" ? "▲" : "▼"} ${Math.abs(changePct)}%`} {days}d</span>
    </span>
  );
}
