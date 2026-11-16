import { Plat } from "@/components/brand";
import type { Liquidity } from "@/lib/portfolio/metrics";
import { LineChart } from "@/components/line-chart";

export { Spark, SplitBar } from "@/components/mini-charts";

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


/** Portfolio value over time, one point a day. Hover or tap a day for its number. */
export function ValueLine({ points }: { points: { day: string; total: number }[] }) {
  if (points.length < 2) return <p className="text-sm text-dim">The chart fills in as days go by — one point each day you open this page. Come back tomorrow and it starts drawing.</p>;
  return <LineChart ariaLabel={`Portfolio value from ${fmt(points[0].total)} to ${fmt(points[points.length - 1].total)} platinum`} unit="p" area series={[{ name: "Portfolio", cls: "text-gold", points: points.map((p) => ({ t: Date.parse(p.day + "T00:00:00Z"), v: p.total })) }]} />;
}
