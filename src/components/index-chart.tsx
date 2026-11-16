import type { IndexPoint, IndexStats } from "@/lib/insights/index-stats";

const sg = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}%`);
const tone = (n: number | null) => (n == null || n === 0 ? "text-ink" : n > 0 ? "text-ok" : "text-danger");

/** A market index over 90 days: the line, today's level, the recent changes and where it sits in its range. */
export function IndexChart({ title, note, points, stats }: { title: string; note: string; points: IndexPoint[]; stats: IndexStats | null }) {
  if (!stats) return <div className="card text-sm text-dim"><p className="text-ink">{title}</p><p>Not enough history yet.</p></div>;
  const W = 640, H = 150, P = 6;
  const lo = Math.min(...points.map((p) => p.idx)), hi = Math.max(...points.map((p) => p.idx)), span = hi - lo || 1;
  const x = (i: number) => P + (i / (points.length - 1)) * (W - 2 * P), y = (v: number) => H - P - ((v - lo) / span) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.idx).toFixed(1)}`).join("");
  const level = stats.position >= 80 ? "near its 90-day high" : stats.position <= 20 ? "near its 90-day low" : "mid-range";
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-ink">{title}</p>
        <p className="h-display text-2xl">{stats.now}<span className="ml-2 text-sm font-normal text-dim">100 = 90 days ago</span></p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full text-gold" preserveAspectRatio="none" role="img" aria-label={`${title}: from ${stats.start} to ${stats.now}`}>
        <line x1={P} x2={W - P} y1={y(100)} y2={y(100)} stroke="currentColor" opacity="0.2" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div><p className="text-xs text-dim">Last 7 days</p><p className={`h-display text-lg ${tone(stats.change7)}`}>{sg(stats.change7)}</p></div>
        <div><p className="text-xs text-dim">Last 30 days</p><p className={`h-display text-lg ${tone(stats.change30)}`}>{sg(stats.change30)}</p></div>
        <div><p className="text-xs text-dim">Where it sits</p><p className="h-display text-lg text-ink">{stats.position}%</p><p className="text-xs text-dim">{level}</p></div>
      </div>
      <p className="text-xs text-dim">{note} 90-day range {stats.low.idx}–{stats.high.idx}.</p>
    </div>
  );
}
