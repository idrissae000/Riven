"use client";

import { useRef, useState } from "react";

export interface LineSeries {
  name: string;
  /** a Tailwind text colour, e.g. "text-plat" (the line uses currentColor) */
  cls: string;
  dash?: boolean;
  width?: number;
  points: { t: number; v: number }[];
}
export interface LineBand { from: number; to: number; label?: string }
export interface LineRef { v: number; label: string }

const fmtNum = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));
const fmtDay = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const nearest = (pts: { t: number; v: number }[], t: number) => {
  let best = -1, d = Infinity;
  for (let i = 0; i < pts.length; i++) { const x = Math.abs(pts[i].t - t); if (x < d) { d = x; best = i; } }
  return best < 0 ? null : { p: pts[best], d };
};

/**
 * A line chart you can read: hover (or tap, or use the arrow keys) and a guide line, a dot on each line and a box with the date and every value
 * appear. Series can have different dates (the nearest one within `reach` days is used). Optional shaded date ranges and dashed reference lines.
 */
export function LineChart({ series, bands = [], refs = [], unit = "", height = 144, area = false, ariaLabel, reachDays = 2, yFrom }: {
  series: LineSeries[]; bands?: LineBand[]; refs?: LineRef[]; unit?: string; height?: number; area?: boolean; ariaLabel: string; reachDays?: number; yFrom?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null); // index into `times`
  const live = series.filter((s) => s.points.length > 0);
  const times = [...new Set(live.flatMap((s) => s.points.map((p) => p.t)))].sort((a, b) => a - b);
  if (times.length < 2) return <p className="text-sm text-dim">Not enough days of data to draw a chart yet.</p>;

  const t0 = times[0], t1 = times[times.length - 1];
  const all = [...live.flatMap((s) => s.points.map((p) => p.v)), ...refs.map((r) => r.v)];
  const lo = yFrom ?? Math.min(...all), hi = Math.max(...all), pad = (hi - lo || Math.abs(hi) || 1) * 0.1;
  const y0 = yFrom != null ? lo : lo - pad, y1 = hi + pad;
  const W = 640, H = height, P = 6;
  const fx = (t: number) => (t - t0) / Math.max(1, t1 - t0);
  const fy = (v: number) => (H - P - ((v - y0) / (y1 - y0 || 1)) * (H - 2 * P)) / H;
  const x = (t: number) => P + fx(t) * (W - 2 * P);
  const path = (pts: { t: number; v: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${(fy(p.v) * H).toFixed(1)}`).join("");

  const at = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const t = t0 + Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * (t1 - t0);
    const n = nearest(times.map((v) => ({ t: v, v })), t);
    if (n) setActive(times.indexOf(n.p.t));
  };
  const tActive = active != null ? times[Math.min(active, times.length - 1)] : null;
  const rows = tActive == null ? [] : live.flatMap((s) => { const n = nearest(s.points, tActive); return n && n.d <= reachDays * 86_400_000 ? [{ s, p: n.p }] : []; });
  const left = tActive == null ? 0 : fx(tActive) * 100;

  return (
    <div className="space-y-1">
      <div
        ref={box} tabIndex={0} role="img" aria-label={ariaLabel}
        className="relative cursor-crosshair touch-pan-y rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-gold"
        style={{ height }}
        onPointerMove={(e) => at(e.clientX)} onPointerDown={(e) => at(e.clientX)}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setActive(null); }}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setActive((a) => Math.min(times.length - 1, Math.max(0, (a ?? times.length - 1) + (e.key === "ArrowLeft" ? -1 : 1)))); }
          if (e.key === "Escape") setActive(null);
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {bands.map((b, i) => <rect key={i} x={x(Math.max(t0, b.from))} y={0} width={Math.max(3, x(Math.min(t1, b.to)) - x(Math.max(t0, b.from)))} height={H} className="fill-current text-gold" opacity="0.14" />)}
          {refs.map((r) => <line key={r.label} x1={0} x2={W} y1={fy(r.v) * H} y2={fy(r.v) * H} stroke="currentColor" className="text-dim" opacity="0.5" strokeDasharray="5 5" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />)}
          {area && live[0] && <path d={`${path(live[0].points)}L${x(live[0].points[live[0].points.length - 1].t)},${H}L${x(live[0].points[0].t)},${H}Z`} fill="currentColor" className={live[0].cls} opacity="0.1" />}
          {live.map((s) => <path key={s.name} d={path(s.points)} fill="none" stroke="currentColor" className={s.cls} strokeWidth={s.width ?? 2} strokeDasharray={s.dash ? "4 3" : undefined} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
        </svg>
        {tActive != null && (
          <>
            <div className="pointer-events-none absolute inset-y-0 w-px bg-ink/40" style={{ left: `${left}%` }} />
            {rows.map(({ s, p }) => <span key={s.name} className={`pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-void bg-current ${s.cls}`} style={{ left: `${fx(p.t) * 100}%`, top: `${fy(p.v) * 100}%` }} />)}
            <div className="pointer-events-none absolute top-1 z-10 w-max max-w-[14rem] rounded-sm border border-line-2 bg-void/95 px-2 py-1.5 text-xs shadow-lg" style={left > 55 ? { right: `${100 - left + 2}%` } : { left: `${left + 2}%` }}>
              <p className="text-dim">{fmtDay(tActive)}</p>
              {rows.length === 0 ? <p className="text-dim">no data this day</p> : rows.map(({ s, p }) => <p key={s.name} className="flex items-center justify-between gap-3"><span className={s.cls}>{live.length > 1 ? s.name : ""}</span><b className="text-ink">{fmtNum(p.v)}{unit}</b></p>)}
            </div>
          </>
        )}
      </div>
      <p className="flex flex-wrap justify-between gap-2 text-xs text-dim">
        <span>{fmtDay(t0)}</span>
        <span>{tActive == null ? "Hover, tap or use ← → to read a day" : ""}</span>
        <span>{fmtDay(t1)}</span>
      </p>
    </div>
  );
}
