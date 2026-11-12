"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mergeDays, nearestIndex, niceTicks, rangeStats, type AskingDay } from "@/lib/chart";
import type { SalesDay } from "@/lib/history-sales";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];
const H = 300, PAD = { l: 44, r: 12, t: 12, b: 26 }, VOL_H = 46;
const fmt = (n: number | null | undefined) => (n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1));
const dayLabel = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Interactive price history: real sales (average, low–high band, units sold) plus our own asking-price snapshots. Hover or tap for a day; click to pin it. */
export function PriceChart({ name, sales, asking }: { name: string; sales: SalesDay[]; asking: AskingDay[] }) {
  const [range, setRange] = useState<Range>(90);
  const [show, setShow] = useState({ sold: true, band: true, asking: true, volume: true });
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const days = useMemo(() => mergeDays(sales, asking, range), [sales, asking, range]);
  const stats = useMemo(() => rangeStats(days), [days]);

  if (!days.length) return <section className="card"><h2 className="kicker">Price history</h2><p className="mt-2 text-sm text-dim">No history yet for {name} — it’s copied from Warframe Market in the background and shows up here shortly.</p></section>;

  const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b - (show.volume ? VOL_H + 6 : 0);
  const t0 = days[0].t, t1 = days[days.length - 1].t;
  const x = (t: number) => PAD.l + (t1 === t0 ? plotW / 2 : ((t - t0) / (t1 - t0)) * plotW);
  const prices = days.flatMap((d) => [show.sold ? d.sold : null, show.band ? d.soldMin : null, show.band ? d.soldMax : null, show.asking ? d.asking : null].filter((v): v is number => v != null));
  const lo = Math.min(...(prices.length ? prices : [0])), hi = Math.max(...(prices.length ? prices : [1]));
  const padY = (hi - lo || hi || 1) * 0.1;
  const yMin = Math.max(0, lo - padY), yMax = hi + padY;
  const y = (v: number) => PAD.t + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
  const ticks = niceTicks(yMin, yMax, 4);
  const maxVol = Math.max(1, ...days.map((d) => d.volume ?? 0));
  const volTop = PAD.t + plotH + 6;

  const line = (pick: (d: (typeof days)[number]) => number | null) => {
    let path = "", pen = false;
    for (const d of days) { const v = pick(d); if (v == null) { pen = false; continue; } path += `${pen ? "L" : "M"}${x(d.t).toFixed(1)},${y(v).toFixed(1)}`; pen = true; }
    return path;
  };
  const bandD = (() => {
    const pts = days.filter((d) => d.soldMin != null && d.soldMax != null);
    if (pts.length < 2) return "";
    return `M${pts.map((d) => `${x(d.t).toFixed(1)},${y(d.soldMax!).toFixed(1)}`).join("L")}L${[...pts].reverse().map((d) => `${x(d.t).toFixed(1)},${y(d.soldMin!).toFixed(1)}`).join("L")}Z`;
  })();

  const xs = days.map((d) => x(d.t));
  const active = pinned ?? hover;
  const a = active == null ? null : days[Math.min(active, days.length - 1)];
  const ax = a ? x(a.t) : 0;
  const pointAt = (clientX: number) => { const r = box.current!.getBoundingClientRect(); return nearestIndex(xs, clientX - r.left); };
  const xTicks = [0, Math.floor((days.length - 1) / 2), days.length - 1].filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="kicker">Price history</h2>
        <div role="tablist" aria-label="Time range" className="inline-flex gap-1 border border-line bg-panel-2/60 p-1">
          {RANGES.map((r) => (
            <button key={r} role="tab" aria-selected={range === r} onClick={() => { setRange(r); setPinned(null); setHover(null); }}
              className={`min-h-8 px-3 font-display text-xs font-semibold uppercase tracking-wider ${range === r ? "bg-gold/15 text-gold" : "text-dim hover:text-ink"}`}>{r}d</button>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-5">
        <Stat label="Avg paid" value={fmt(stats.avg)} />
        <Stat label="Lowest paid" value={fmt(stats.low)} />
        <Stat label="Highest paid" value={fmt(stats.high)} />
        <Stat label="Units sold" value={String(stats.units)} />
        <Stat label={`Change (${range}d)`} value={stats.changePct == null ? "—" : `${stats.changePct > 0 ? "+" : ""}${stats.changePct}%`} tone={stats.changePct == null || Math.abs(stats.changePct) < 5 ? "" : stats.changePct > 0 ? "text-ok" : "text-danger"} />
      </dl>

      <div ref={box} className="relative select-none" style={{ touchAction: "pan-y" }}>
        <svg width={W} height={H} role="img" aria-label={`${name} price over the last ${range} days`}
          onPointerMove={(e) => setHover(pointAt(e.clientX))} onPointerLeave={() => setHover(null)}
          onClick={(e) => { const i = pointAt(e.clientX); setPinned((p) => (p === i ? null : i)); }}>
          {ticks.map((v) => (
            <g key={v}><line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-line" strokeDasharray="2 4" />
              <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="fill-current text-dim" fontSize="12">{fmt(v)}</text></g>
          ))}
          {xTicks.map((i) => <text key={i} x={Math.min(Math.max(xs[i], PAD.l + 18), W - PAD.r - 18)} y={H - 6} textAnchor="middle" className="fill-current text-dim" fontSize="12">{dayLabel(days[i].day)}</text>)}
          {show.volume && days.map((d) => d.volume ? <rect key={d.day} x={x(d.t) - Math.max(1, Math.min(6, plotW / days.length / 2 - 0.5))} width={Math.max(2, Math.min(12, plotW / days.length - 1))} y={volTop + VOL_H - (d.volume / maxVol) * VOL_H} height={(d.volume / maxVol) * VOL_H} className="fill-current text-teal" opacity="0.35" /> : null)}
          {show.band && bandD && <path d={bandD} className="fill-current text-plat" opacity="0.14" />}
          {show.asking && <path d={line((d) => d.asking)} fill="none" stroke="currentColor" className="text-teal" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />}
          {show.sold && <path d={line((d) => d.sold)} fill="none" stroke="currentColor" className="text-plat" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />}
          {show.asking && days.length < 40 && days.map((d) => d.asking != null && <circle key={`a${d.day}`} cx={x(d.t)} cy={y(d.asking)} r="2.5" className="fill-current text-teal" />)}
          {a && (
            <g pointerEvents="none">
              <line x1={ax} x2={ax} y1={PAD.t} y2={PAD.t + plotH} stroke="currentColor" className="text-ink/50" strokeWidth="1" />
              {show.sold && a.sold != null && <circle cx={ax} cy={y(a.sold)} r="4.5" className="fill-current text-plat" stroke="var(--background, #000)" strokeWidth="1.5" />}
              {show.asking && a.asking != null && <circle cx={ax} cy={y(a.asking)} r="4" className="fill-current text-teal" stroke="var(--background, #000)" strokeWidth="1.5" />}
            </g>
          )}
        </svg>
        {a && (
          <div className="pointer-events-none absolute top-2 z-10 w-44 border border-line bg-panel/95 p-2.5 text-xs shadow-lg"
            style={{ left: ax > W / 2 ? Math.max(0, ax - 188) : Math.min(W - 176, ax + 12) }}>
            <p className="mb-1 font-display text-sm font-semibold text-ink">{dayLabel(a.day)}{pinned != null && <span className="ml-1 font-normal text-dim">· pinned</span>}</p>
            <Row label="Avg paid" value={a.sold != null ? `${fmt(a.sold)}p` : "no sales"} tone="text-plat" />
            {a.soldMin != null && a.soldMax != null && <Row label="Range" value={`${fmt(a.soldMin)}–${fmt(a.soldMax)}p`} />}
            <Row label="Units sold" value={a.volume != null ? String(a.volume) : "—"} />
            {a.asking != null && <Row label="Asking" value={`${fmt(a.asking)}p`} tone="text-teal" />}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-dim">
        <Toggle on={show.sold} set={(v) => setShow((s) => ({ ...s, sold: v }))} swatch="bg-plat" label="Avg price paid" />
        <Toggle on={show.band} set={(v) => setShow((s) => ({ ...s, band: v }))} swatch="bg-plat/30" label="Low–high paid" />
        <Toggle on={show.asking} set={(v) => setShow((s) => ({ ...s, asking: v }))} swatch="bg-teal" label="Asking price (our snapshots)" />
        <Toggle on={show.volume} set={(v) => setShow((s) => ({ ...s, volume: v }))} swatch="bg-teal/40" label="Units sold" />
      </div>
      <p className="text-xs text-dim">Prices paid come from Warframe Market’s closed trades (rank 0), one point per day. Asking prices are the average of the 5 cheapest listings that we save once a day, so that line starts the day tracking began. Hover or tap for a day; click to pin it.</p>
    </section>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div><dt className="text-xs text-dim">{label}</dt><dd className={`h-display text-lg ${tone || "text-ink"}`}>{value}</dd></div>;
}
function Row({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return <p className="flex justify-between gap-2"><span className="text-dim">{label}</span><span className={tone}>{value}</span></p>;
}
function Toggle({ on, set, swatch, label }: { on: boolean; set: (v: boolean) => void; swatch: string; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5">
      <input type="checkbox" className="sr-only" checked={on} onChange={(e) => set(e.target.checked)} />
      <span className={`h-2.5 w-4 rounded-sm ${on ? swatch : "border border-line"}`} aria-hidden="true" />
      <span className={on ? "text-ink" : "line-through"}>{label}</span>
    </label>
  );
}
