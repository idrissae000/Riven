import { Plat } from "@/components/brand";
import type { Liquidity } from "@/lib/portfolio/metrics";

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 1 }));

export function Tile({ label, value, sub, plat = false, tone }: { label: string; value: string; sub?: string; plat?: boolean; tone?: "up" | "down" }) {
  return (
    <div className="card !p-3.5">
      <p className="text-xs text-dim">{label}</p>
      <p className={`h-display mt-0.5 flex items-center gap-1.5 text-3xl ${tone === "up" ? "text-ok" : tone === "down" ? "text-danger" : "text-ink"}`}>{value}{plat && <Plat size={20} />}</p>
      {sub && <p className="mt-0.5 text-xs text-dim">{sub}</p>}
    </div>
  );
}

const LIQ: Record<Liquidity, { label: string; cls: string; hint: string }> = {
  fast: { label: "fast", cls: "text-ok", hint: "5+ sold a day across the market" },
  steady: { label: "steady", cls: "text-ink", hint: "1–5 sold a day" },
  slow: { label: "slow", cls: "text-orange", hint: "under 1 a day: expect to wait" },
  stuck: { label: "stuck", cls: "text-danger", hint: "under 1 every 4 days: very hard to move" },
  unknown: { label: "—", cls: "text-dim", hint: "not enough sales history yet" },
};
export function LiquidityBadge({ liquidity, perDay }: { liquidity: Liquidity; perDay: number | null }) {
  const l = LIQ[liquidity];
  return <span className={`whitespace-nowrap text-xs ${l.cls}`} title={l.hint}>{l.label}{perDay != null ? ` · ${fmt(perDay)}/day` : ""}</span>;
}

export function Change({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-dim">—</span>;
  return <span className={`whitespace-nowrap text-xs ${pct > 0 ? "text-ok" : pct < 0 ? "text-danger" : "text-dim"}`}>{pct > 0 ? "▲" : pct < 0 ? "▼" : ""} {Math.abs(pct)}%</span>;
}

/** A small line of recent prices. */
export function Spark({ values, w = 64, h = 20 }: { values: number[]; w?: number; h?: number }) {
  if (values.length < 2) return <span className="inline-block" style={{ width: w }} />;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className={`overflow-visible ${up ? "text-ok" : "text-danger"}`}><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

/** Portfolio value over time, one point a day. */
export function ValueLine({ points }: { points: { day: string; total: number }[] }) {
  if (points.length < 2) return <p className="text-sm text-dim">The chart fills in as days go by — one point each day you open this page. Come back tomorrow and it starts drawing.</p>;
  const W = 640, H = 160, P = 6;
  const lo = Math.min(...points.map((p) => p.total)), hi = Math.max(...points.map((p) => p.total)), span = hi - lo || 1;
  const x = (i: number) => P + (i / (points.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / span) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join("");
  const first = points[0], last = points[points.length - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full text-gold" role="img" aria-label={`Portfolio value from ${fmt(first.total)} to ${fmt(last.total)} platinum`} preserveAspectRatio="none">
        <path d={`${d}L${x(points.length - 1)},${H}L${x(0)},${H}Z`} fill="currentColor" opacity="0.1" />
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <p className="mt-1 flex justify-between text-xs text-dim"><span>{first.day} · {fmt(first.total)}p</span><span>{last.day} · {fmt(last.total)}p</span></p>
    </div>
  );
}

/** A horizontal split bar with a legend. */
export function SplitBar({ parts }: { parts: { label: string; pct: number; cls: string }[] }) {
  const shown = parts.filter((p) => p.pct > 0);
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-sm bg-panel-2" role="img" aria-label={shown.map((p) => `${p.label} ${p.pct}%`).join(", ")}>
        {shown.map((p) => <div key={p.label} className={p.cls} style={{ width: `${p.pct}%` }} />)}
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">{shown.map((p) => <span key={p.label}><span className={`mr-1 inline-block h-2 w-2 ${p.cls}`} />{p.label} {p.pct}%</span>)}</p>
    </div>
  );
}
