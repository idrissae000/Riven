"use client";

import { useMemo, useState } from "react";
import { PriceChart } from "@/components/price-chart";
import { trackSinceBaro, trackingNote, type Tracking } from "@/lib/baro/tracking";
import type { AskingDay } from "@/lib/chart";
import type { SalesDay } from "@/lib/history-sales";

export interface AwayRow { name: string; ducats: number | null; credits: number | null; slug: string; priceNow: number | null }

type SortKey = "rise" | "price" | "speed" | "name";
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const DAY = 86_400_000;
const dayMs = (iso: string) => Date.parse(iso.slice(0, 10) + "T00:00:00Z");
const short = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const cr = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-US"));

type State = "recovering" | "usual" | "low" | "falling" | "unknown";
const STATE: Record<State, { label: string; cls: string }> = {
  recovering: { label: "Recovering", cls: "border-ok/60 bg-ok/10 text-ok" },
  usual: { label: "Back to usual", cls: "border-gold/60 bg-gold/10 text-gold" },
  low: { label: "Still low", cls: "border-orange/50 bg-orange/10 text-orange" },
  falling: { label: "Falling", cls: "border-danger/50 bg-danger/10 text-danger" },
  unknown: { label: "Not enough data", cls: "border-line text-dim" },
};
const stateOf = (t: Tracking): State => (t.recent == null || t.during == null ? "unknown" : t.vsUsual != null && t.vsUsual >= -5 ? "usual" : t.vsDuring != null && t.vsDuring >= 5 ? "recovering" : t.vsDuring != null && t.vsDuring <= -5 ? "falling" : "low");

/**
 * While Baro is away: the items he brought on his last visit, tracked against how they sold while he was here — price versus then and
 * versus their usual price, how fast they're selling, and a chart from the week before he came to today.
 */
export function BaroAway({ rows, history, asking, arrival }: { rows: AwayRow[]; history: Record<string, SalesDay[]>; asking: Record<string, AskingDay[]>; arrival: string }) {
  const [sort, setSort] = useState<SortKey>("rise");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const tracked = useMemo(() => rows.map((r) => ({ ...r, t: trackSinceBaro(history[r.slug] ?? [], arrival) })), [rows, history, arrival]);
  const needle = q.trim().toLowerCase();
  const key = (r: (typeof tracked)[number]) => (sort === "rise" ? r.t.vsDuring : sort === "price" ? r.t.recent ?? r.priceNow : sort === "speed" ? r.t.sinceVolume : null);
  const list = tracked.filter((r) => !needle || r.name.toLowerCase().includes(needle))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : (key(b) ?? -Infinity) - (key(a) ?? -Infinity) || a.name.localeCompare(b.name)));

  const withData = tracked.filter((r) => r.t.recent != null);
  const days = Math.max(0, ...tracked.map((r) => r.t.days));
  const back = withData.filter((r) => stateOf(r.t) === "usual").length;
  const rising = withData.filter((r) => (r.t.vsDuring ?? 0) >= 5).length;
  const best = [...withData].sort((a, b) => (b.t.vsDuring ?? -Infinity) - (a.t.vsDuring ?? -Infinity))[0];
  const bands = [{ from: arrival.slice(0, 10), to: new Date(dayMs(arrival) + 2 * DAY).toISOString().slice(0, 10), label: "Baro" }];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Glance label="Days since he left" value={String(days)} sub={`visit of ${short(arrival)}`} />
        <Glance label="Up since he left" value={`${rising} of ${withData.length}`} sub="5%+ above his-visit price" />
        <Glance label="Back to usual" value={`${back} of ${withData.length}`} sub="within 5% of the week before" />
        <Glance label="Biggest rebound" value={best?.name ?? "—"} sub={best?.t.vsDuring != null ? `+${best.t.vsDuring}% vs while here` : "no sales yet"} small />
      </section>

      <section className="card space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_16rem]">
          <input className="input" type="search" placeholder="Search last visit’s items…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
            <option value="rise">Biggest rise since he left</option>
            <option value="price">Highest price now</option>
            <option value="speed">Selling fastest</option>
            <option value="name">Name</option>
          </select>
        </div>
        <p className="text-xs text-dim">Prices are daily averages of completed trades (rank 0). “While here” is his 3 days; “now” is the median of the last 3 days of sales. Asking prices (the average of the 5 cheapest online sellers) are tracked hourly and shown as the dashed line once there are a few days of them.</p>
      </section>

      <ul className="space-y-3">
        {list.map((r) => {
          const t = r.t, st = STATE[stateOf(t)];
          const isOpen = open === r.name;
          return (
            <li key={r.name} className="tile space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold leading-tight">{r.name}</h3>
                  <p className="mt-0.5 text-sm text-dim">Baro sold it for {cr(r.credits)} credits + {r.ducats ?? "—"} ducats</p>
                </div>
                <span className={`shrink-0 border px-2.5 py-1 font-display text-xs font-semibold uppercase tracking-[0.08em] ${st.cls}`}>{st.label}</span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
                <Stat label="Usual (week before)" value={t.usual != null ? `${fmt(t.usual)}p` : "—"} />
                <Stat label="While Baro here" value={t.during != null ? `${fmt(t.during)}p` : "—"} />
                <Stat label="Now (recent sales)" value={t.recent != null ? `${fmt(t.recent)}p` : "—"} sub={r.priceNow != null ? `asking ${fmt(r.priceNow)}p` : undefined} />
                <Stat label="Change vs while here" value={t.vsDuring != null ? `${t.vsDuring > 0 ? "+" : ""}${t.vsDuring}%` : "—"} tone={t.vsDuring == null || Math.abs(t.vsDuring) < 5 ? "" : t.vsDuring > 0 ? "text-ok" : "text-danger"} sub={t.peak ? `peak ${fmt(t.peak.price)}p on ${short(t.peak.day)}` : undefined} />
                <Stat label="Units sold / day" value={t.sinceVolume != null ? fmt(t.sinceVolume) : "—"} sub={t.duringVolume != null ? `${fmt(t.duringVolume)} while here` : undefined} />
              </div>

              <TrackChart sales={history[r.slug] ?? []} asking={asking[r.slug] ?? []} arrival={arrival} usual={t.usual} />
              <p className="text-sm leading-relaxed text-dim">{trackingNote(t, r.priceNow)}</p>

              <div className="flex items-center justify-between gap-3 text-xs">
                <a className="text-dim hover:text-teal" href={`https://warframe.market/items/${r.slug}`} target="_blank" rel="noopener noreferrer">warframe.market ↗</a>
                <button className="btn min-h-8 px-3 text-xs" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.name)}>{isOpen ? "Hide full chart" : "Full 90-day chart"}</button>
              </div>
              {isOpen && <PriceChart slug={r.slug} name={r.name} sales={history[r.slug] ?? []} asking={asking[r.slug] ?? []} bands={bands} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** From the week before Baro came to today: the price paid each day, the usual price (dashed), his visit shaded, and our hourly-tracked asking price. */
function TrackChart({ sales, asking, arrival, usual }: { sales: SalesDay[]; asking: AskingDay[]; arrival: string; usual: number | null }) {
  const a0 = dayMs(arrival);
  const from = a0 - 8 * DAY;
  const pts = sales.filter((s) => dayMs(s.day) >= from).sort((a, b) => a.day.localeCompare(b.day));
  const ask = asking.filter((s) => dayMs(s.day) >= from).sort((a, b) => a.day.localeCompare(b.day));
  if (pts.length < 2) return <p className="text-xs text-dim">Not enough days of sales to draw a chart yet.</p>;
  const t1 = Math.max(dayMs(pts[pts.length - 1].day), ask.length ? dayMs(ask[ask.length - 1].day) : 0);
  const W = 600, H = 120;
  const vals = [...pts.map((p) => p.avg), ...ask.map((p) => p.price), ...(usual != null ? [usual] : [])];
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo || hi || 1) * 0.12;
  const x = (t: number) => ((t - from) / Math.max(1, t1 - from)) * W;
  const y = (v: number) => H - 6 - ((v - (lo - pad)) / (hi + pad - (lo - pad) || 1)) * (H - 12);
  const line = (xs: { t: number; v: number }[]) => xs.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-28 w-full" role="img" aria-label="Price since Baro's visit">
        <rect x={x(a0)} y={0} width={Math.max(3, x(a0 + 3 * DAY) - x(a0))} height={H} className="fill-current text-gold" opacity="0.14" />
        {usual != null && <line x1={0} x2={W} y1={y(usual)} y2={y(usual)} stroke="currentColor" className="text-dim" strokeDasharray="5 5" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />}
        {ask.length > 1 && <path d={line(ask.map((p) => ({ t: dayMs(p.day), v: p.price })))} fill="none" stroke="currentColor" className="text-teal" strokeWidth="2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
        <path d={line(pts.map((p) => ({ t: dayMs(p.day), v: p.avg })))} fill="none" stroke="currentColor" className="text-plat" strokeWidth="2.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-dim">
        <span>{short(new Date(from).toISOString())}</span>
        <span className="flex flex-wrap items-center gap-3"><span><span className="text-plat">━</span> price paid</span>{ask.length > 1 && <span><span className="text-teal">┅</span> asking</span>}{usual != null && <span>┅ usual {fmt(usual)}p</span>}<span className="text-gold">▮ Baro here</span></span>
        <span>{short(new Date(t1).toISOString())} · {fmt(lo)}–{fmt(hi)}p</span>
      </div>
    </div>
  );
}

function Glance({ label, value, sub, small = false }: { label: string; value: string; sub: string; small?: boolean }) {
  return (
    <div className="card !p-3.5">
      <p className="text-xs text-dim">{label}</p>
      <p className={`h-display mt-0.5 truncate ${small ? "text-lg" : "text-3xl"} text-ink`}>{value}</p>
      <p className="mt-0.5 text-xs text-dim">{sub}</p>
    </div>
  );
}
function Stat({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: string }) {
  return <div><p className="text-xs text-dim">{label}</p><p className={`h-display flex items-center gap-1 text-xl normal-case ${tone || "text-ink"}`}>{value}</p>{sub && <p className="text-xs text-dim">{sub}</p>}</div>;
}
