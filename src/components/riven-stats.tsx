import { fmtStat } from "@/lib/format";
import type { StatGrade } from "@/lib/grading/grade";
import type { RivenAttribute, RivenStat } from "@/lib/types";
import { GradeBadge, barClass } from "@/components/grade-badge";

/** One row per stat: grade badge, value, position-in-range bar and a one-line explanation. */
export function RivenStats({ stats, attrs, grades }: { stats: RivenStat[]; attrs: Map<string, RivenAttribute>; grades: StatGrade[] }) {
  const gradeOf = new Map(grades.map((g) => [g.stat, g]));
  const anyPlaceholder = grades.some((g) => g.placeholder);
  return (
    <>
        <ul className="mt-4 divide-y divide-line">
          {stats.map((s) => {
            const g = gradeOf.get(s.stat);
            return (
              <li key={s.stat} className="py-3">
                <div className="flex items-center gap-3">
                  <GradeBadge tier={g?.tier ?? null} placeholder={g?.placeholder} />
                  <span className="min-w-0 flex-1 text-dim">{attrs.get(s.stat)?.name ?? s.stat}{s.is_negative && <span className="ml-2 text-xs text-danger">negative</span>}</span>
                  <span className={`font-mono text-lg ${s.is_negative ? "text-danger" : "text-ink"}`}>{fmtStat(s.value, attrs.get(s.stat)?.unit)}</span>
                </div>
                {g?.pct != null && g.tier && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2" aria-hidden>
                    <div className={`h-full rounded-full ${barClass(g.tier)}`} style={{ width: `${Math.max(3, g.pct * 100)}%` }} />
                  </div>
                )}
                {g && <p className="mt-1.5 text-xs leading-relaxed text-dim">{g.explanation}</p>}
              </li>
            );
          })}
        </ul>
        {anyPlaceholder && (
          <p className="mt-3 rounded-lg border border-orange/40 bg-orange/10 p-2.5 text-xs text-orange">
            * Grades marked with an asterisk use <strong>placeholder</strong> roll ranges, not real data. Load the real tables with <code>npm run import:grading</code>.
          </p>
        )}
    </>
  );
}
