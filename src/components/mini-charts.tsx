"use client";

import { useRef, useState } from "react";

const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));

/** A small line of recent prices; hover or tap it to read a day's number. */
export function Spark({ points, w = 64, h = 20, unit = "p" }: { points: { label: string; v: number }[]; w?: number; h?: number; unit?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [i, setI] = useState<number | null>(null);
  if (points.length < 2) return <span className="inline-block" style={{ width: w }} />;
  const vs = points.map((p) => p.v), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const px = (k: number) => (k / (points.length - 1)) * w, py = (v: number) => h - 2 - ((v - lo) / span) * (h - 4);
  const line = points.map((p, k) => `${px(k).toFixed(1)},${py(p.v).toFixed(1)}`).join(" ");
  const up = vs[vs.length - 1] >= vs[0];
  const at = (clientX: number) => { const r = ref.current?.getBoundingClientRect(); if (r && r.width) setI(Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * (points.length - 1))); };
  return (
    <span ref={ref} className={`relative inline-block cursor-crosshair align-middle ${up ? "text-ok" : "text-danger"}`} style={{ width: w, height: h }}
      onPointerMove={(e) => at(e.clientX)} onPointerDown={(e) => at(e.clientX)} onPointerLeave={(e) => { if (e.pointerType === "mouse") setI(null); }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="overflow-visible"><polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
      {i != null && (
        <>
          <span className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" style={{ left: px(i), top: py(points[i].v) }} />
          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-sm border border-line-2 bg-void/95 px-1.5 py-0.5 text-xs text-ink shadow">{points[i].label} · <b>{num(points[i].v)}{unit}</b></span>
        </>
      )}
    </span>
  );
}

export interface SplitPart { label: string; pct: number; cls: string; value?: number }

/** A horizontal split bar; hover or tap a segment for its share and platinum. */
export function SplitBar({ parts }: { parts: SplitPart[] }) {
  const shown = parts.filter((p) => p.pct > 0);
  const [on, setOn] = useState<string | null>(null);
  const cur = shown.find((p) => p.label === on);
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-sm bg-panel-2" role="img" aria-label={shown.map((p) => `${p.label} ${p.pct}%`).join(", ")} onPointerLeave={(e) => { if (e.pointerType === "mouse") setOn(null); }}>
        {shown.map((p) => <div key={p.label} className={`${p.cls} cursor-pointer ${on && on !== p.label ? "opacity-50" : ""}`} style={{ width: `${p.pct}%` }} onPointerEnter={() => setOn(p.label)} onPointerDown={() => setOn(p.label)} />)}
      </div>
      <p className="min-h-4 text-xs text-ink">{cur ? <>{cur.label}: <b>{cur.pct}%</b>{cur.value != null ? <> · {num(Math.round(cur.value))}p</> : null}</> : <span className="text-dim">Hover or tap a segment for the numbers</span>}</p>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">{shown.map((p) => <span key={p.label}><span className={`mr-1 inline-block h-2 w-2 ${p.cls}`} />{p.label} {p.pct}%</span>)}</p>
    </div>
  );
}
