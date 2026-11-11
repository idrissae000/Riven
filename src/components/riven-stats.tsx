import type { CSSProperties } from "react";
import { fmtStat } from "@/lib/format";
import type { StatGrade } from "@/lib/grading/grade";
import type { RivenAttribute, RivenStat } from "@/lib/types";
import { GradeBadge, tierColor } from "@/components/grade-badge";

const plain = (v: number, unit: string | null | undefined) => fmtStat(v, unit).replace(/^\+/, "");
const pctText = (n: number) => `${+n.toFixed(1)}`;

/** One block per stat: grade hexagon, value, a gauge between the lowest and highest possible roll, the why, and the band table. */
export function RivenStats({ stats, attrs, grades }: { stats: RivenStat[]; attrs: Map<string, RivenAttribute>; grades: StatGrade[] }) {
  const gradeOf = new Map(grades.map((g) => [g.stat, g]));
  const notes = [...new Set(grades.map((g) => g.note).filter((n): n is string => !!n))];
  return (
    <>
      <ul className="mt-5 space-y-6">
        {stats.map((s) => {
          const g = gradeOf.get(s.stat);
          const unit = attrs.get(s.stat)?.unit;
          return (
            <li key={s.stat}>
              <div className="flex items-center gap-3">
                <GradeBadge tier={g?.tier ?? null} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold uppercase tracking-[0.1em]">{attrs.get(s.stat)?.name ?? s.stat}</p>
                  {s.is_negative && <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-danger">negative stat</p>}
                </div>
                <span className={`font-mono text-xl tabular-nums ${s.is_negative ? "text-danger" : "text-ink"}`}>{fmtStat(s.value, unit)}</span>
              </div>

              {g?.pct != null && g.tier && g.ends && (
                <div className="mt-3" style={{ "--tier": tierColor(g.tier), "--pct": g.pct } as CSSProperties}>
                  <div className="gauge"><div className="gauge-fill" /><span className="gauge-marker" /></div>
                  {/* Left end = lowest grade (F), right end = highest (S), for every stat. */}
                  <div className="mt-1.5 flex justify-between font-mono text-xs text-dim">
                    <span>{plain(g.ends.worst, unit)}</span>
                    {g.context && <span className="font-sans uppercase tracking-wider">{g.context}</span>}
                    <span>{plain(g.ends.best, unit)}</span>
                  </div>
                </div>
              )}

              {g && <p className="mt-1.5 text-[0.8rem] leading-relaxed text-dim">{g.explanation}</p>}

              {g && g.bands.length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-display text-xs font-semibold uppercase tracking-[0.1em] text-gold hover:text-ink">{g.gradeSource === "curse-weapon" || g.gradeSource === "curse-stat" ? "Where the roll sits (information only — this curse’s grade is fixed)" : "Grade bands for this stat"}</summary>
                  <table className="mt-2 w-full max-w-sm border-collapse font-mono">
                    <thead>
                      <tr className="text-left font-display text-xs uppercase tracking-[0.1em] text-dim">
                        <th className="py-1 pr-3 font-semibold">Grade</th><th className="py-1 pr-3 font-semibold">Roll range</th><th className="py-1 font-semibold">% of range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.bands.map((b) => (
                        <tr key={b.grade} className={b.grade === g.rollGrade ? "bg-gold/10 text-ink" : "text-dim"}>
                          <td className="py-0.5 pr-3 font-display font-bold" style={{ color: tierColor(b.grade) }}>{b.grade}</td>
                          <td className="py-0.5 pr-3">{plain(b.from, unit)} – {plain(b.to, unit)}</td>
                          <td className="py-0.5">{pctText(b.fromPct)}–{pctText(b.toPct)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </li>
          );
        })}
      </ul>
      {notes.map((n) => <p key={n} className="mt-4 border border-line-2 bg-panel-2/60 p-2.5 text-xs leading-relaxed text-dim">{n}</p>)}
      {grades.some((g) => g.tier) && (
        <p className="mt-4 text-xs leading-relaxed text-dim">
          Positive stats are graded by how high the roll sits in its possible range, using the browse.wf Riven Calculator’s bands.
          {grades.some((g) => g.gradeSource.startsWith("curse")) && " A curse gets a fixed rating for the stat (and the weapon) instead of a roll grade, so it reads the same at any roll; its gauge still shows where the roll sits."}
          {" "}Ranges are for a max-rank riven.
        </p>
      )}
    </>
  );
}
