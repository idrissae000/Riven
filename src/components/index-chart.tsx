import { LineChart } from "@/components/line-chart";
import type { IndexPoint, IndexStats } from "@/lib/insights/index-stats";

const sg = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}%`);
const tone = (n: number | null) => (n == null || n === 0 ? "text-ink" : n > 0 ? "text-ok" : "text-danger");

/** A market index over 90 days: the line (hover or tap a day for its level), today's level, the recent changes and where it sits in its range. */
export function IndexChart({ title, note, points, stats }: { title: string; note: string; points: IndexPoint[]; stats: IndexStats | null }) {
  if (!stats) return <div className="card text-sm text-dim"><p className="text-ink">{title}</p><p>Not enough history yet.</p></div>;
  const level = stats.position >= 80 ? "near its 90-day high" : stats.position <= 20 ? "near its 90-day low" : "mid-range";
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-ink">{title}</p>
        <p className="h-display text-2xl">{stats.now}<span className="ml-2 text-sm font-normal text-dim">100 = 90 days ago</span></p>
      </div>
      <LineChart ariaLabel={`${title}: from ${stats.start} to ${stats.now}`} series={[{ name: title, cls: "text-gold", points: points.map((p) => ({ t: Date.parse(p.day + "T00:00:00Z"), v: p.idx })) }]} refs={[{ v: 100, label: "start" }]} />
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div><p className="text-xs text-dim">Last 7 days</p><p className={`h-display text-lg ${tone(stats.change7)}`}>{sg(stats.change7)}</p></div>
        <div><p className="text-xs text-dim">Last 30 days</p><p className={`h-display text-lg ${tone(stats.change30)}`}>{sg(stats.change30)}</p></div>
        <div><p className="text-xs text-dim">Where it sits</p><p className="h-display text-lg text-ink">{stats.position}%</p><p className="text-xs text-dim">{level}</p></div>
      </div>
      <p className="text-xs text-dim">{note} 90-day range {stats.low.idx}–{stats.high.idx}.</p>
    </div>
  );
}
