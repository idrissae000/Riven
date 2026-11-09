import type { CSSProperties } from "react";
import { fmtStat } from "@/lib/format";
import type { StatGrade } from "@/lib/grading/grade";
import type { RivenAttribute, RivenStat } from "@/lib/types";
import { GradeBadge, tierColor } from "@/components/grade-badge";

const plain = (v: number, unit: string | null | undefined) => fmtStat(v, unit).replace(/^\+/, "");

/** One block per stat: tier hexagon, value, a gauge showing where the roll sits between min and max, and the why. */
export function RivenStats({ stats, attrs, grades }: { stats: RivenStat[]; attrs: Map<string, RivenAttribute>; grades: StatGrade[] }) {
  const gradeOf = new Map(grades.map((g) => [g.stat, g]));
  const anyPlaceholder = grades.some((g) => g.placeholder);
  return (
    <>
      <ul className="mt-5 space-y-5">
        {stats.map((s) => {
          const g = gradeOf.get(s.stat);
          const unit = attrs.get(s.stat)?.unit;
          const inverted = attrs.get(s.stat)?.inverted;
          return (
            <li key={s.stat}>
              <div className="flex items-center gap-3">
                <GradeBadge tier={g?.tier ?? null} placeholder={g?.placeholder} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold uppercase tracking-[0.1em]">{attrs.get(s.stat)?.name ?? s.stat}</p>
                  {s.is_negative && <p className="font-display text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-danger">negative stat</p>}
                </div>
                <span className={`font-mono text-xl tabular-nums ${s.is_negative ? "text-danger" : "text-ink"}`}>{fmtStat(s.value, unit)}</span>
              </div>
              {g?.pct != null && g.tier && g.range && (
                <div className="mt-3" style={{ "--tier": tierColor(g.tier), "--pct": g.pct } as CSSProperties}>
                  <div className="gauge"><div className="gauge-fill" /><span className="gauge-marker" /></div>
                  <div className="mt-1.5 flex justify-between font-mono text-[0.68rem] text-dim">
                    {/* Left end is always the worst roll, right end the best (so inverted stats like Recoil read the same way). */}
                    <span>{plain(inverted ? g.range.max : g.range.min, unit)}</span>
                    <span>{plain(inverted ? g.range.min : g.range.max, unit)}</span>
                  </div>
                </div>
              )}
              {g && <p className="mt-1.5 text-[0.8rem] leading-relaxed text-dim">{g.explanation}</p>}
            </li>
          );
        })}
      </ul>
      {anyPlaceholder && (
        <p className="mt-5 border border-orange/40 bg-orange/10 p-2.5 text-xs leading-relaxed text-orange">
          * Marked grades use <strong>placeholder</strong> roll ranges, not real data. Load the real tables with <code className="font-mono">npm run import:grading</code>.
        </p>
      )}
    </>
  );
}
