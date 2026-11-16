"use client";

import { useRef, useState } from "react";
import type { Trend } from "@/lib/history";

/** A tiny price chart plus the 7-day move, e.g. "▲ 40% 7d". Hover or tap the chart for a day's price. Renders nothing until there are two days of history. */
export function TrendBadge({ trend, compact = false }: { trend: Trend | null | undefined; compact?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [i, setI] = useState<number | null>(null);
  if (!trend) return null;
  const { prices, dir, changePct, days } = trend;
  const lo = Math.min(...prices), hi = Math.max(...prices), span = hi - lo || 1;
  const W = 56, H = 18;
  const px = (k: number) => (k / (prices.length - 1)) * W, py = (v: number) => H - 2 - ((v - lo) / span) * (H - 4);
  const pts = prices.map((p, k) => `${px(k).toFixed(1)},${py(p).toFixed(1)}`).join(" ");
  const color = dir === "up" ? "text-ok" : dir === "down" ? "text-danger" : "text-dim";
  const at = (clientX: number) => { const r = ref.current?.getBoundingClientRect(); if (r && r.width) setI(Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * (prices.length - 1))); };
  const ago = (k: number) => { const d = prices.length - 1 - k; return d === 0 ? "now" : d === 1 ? "1 day ago" : `${d} days ago`; };
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs ${color}`} title={`Price over the last ${prices.length} days we’ve tracked`}>
      {!compact && (
        <span ref={ref} className="relative inline-block cursor-crosshair" style={{ width: W, height: H }} onPointerMove={(e) => at(e.clientX)} onPointerDown={(e) => at(e.clientX)} onPointerLeave={(e) => { if (e.pointerType === "mouse") setI(null); }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="overflow-visible"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
          {i != null && (
            <>
              <span className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" style={{ left: px(i), top: py(prices[i]) }} />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-sm border border-line-2 bg-void/95 px-1.5 py-0.5 text-xs text-ink shadow">{ago(i)} · <b>{prices[i]}p</b></span>
            </>
          )}
        </span>
      )}
      <span>{dir === "flat" ? "flat" : `${dir === "up" ? "▲" : "▼"} ${Math.abs(changePct)}%`} {days}d</span>
    </span>
  );
}
