import { Plat } from "@/components/brand";
import { Change } from "@/components/portfolio";
import type { Outcome } from "@/lib/varzia/history";

export interface PastRotation { visit: string; ends: string | null; sets: { name: string; regal: number | null; outcome: Outcome | null }[] }
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Earlier Prime Resurgence rotations: what each set sold for when Varzia left and what it sells for now. */
export function VarziaPast({ rotations }: { rotations: PastRotation[] }) {
  return (
    <section className="space-y-3">
      <h2 className="kicker">Past rotations — what happened after she left</h2>
      {rotations.length === 0 ? (
        <p className="card text-sm text-dim">We started recording her rotations recently, so there’s no finished rotation to look back on yet. Each one is saved while it runs; once it ends, this shows how every set’s price moved afterwards.</p>
      ) : rotations.map((r) => (
        <div key={r.visit} className="card space-y-2">
          <p className="text-sm text-ink">Rotation of {day(r.visit)}{r.ends ? <span className="text-dim"> → {day(r.ends)}</span> : null}</p>
          <ul className="divide-y divide-line text-sm">
            {r.sets.map((s) => (
              <li key={s.name} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                <span className="min-w-0 truncate text-ink">{s.name}{s.regal != null ? <span className="text-xs text-dim"> · {s.regal} Regal Aya</span> : null}</span>
                {s.outcome && s.outcome.atEnd != null ? (
                  <span className="flex items-center gap-3 text-xs text-dim">
                    <span>when she left <b className="inline-flex items-center gap-0.5 text-plat">{s.outcome.atEnd}<Plat size={11} /></b></span>
                    <span>now <b className="inline-flex items-center gap-0.5 text-plat">{s.outcome.now ?? "—"}{s.outcome.now != null && <Plat size={11} />}</b></span>
                    <Change pct={s.outcome.changePct} />
                    <span>{s.outcome.daysSince}d ago</span>
                  </span>
                ) : <span className="text-xs text-dim">no sales data for this set</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
