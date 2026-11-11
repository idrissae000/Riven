import Link from "next/link";
import { GradeBadge } from "@/components/grade-badge";
import { RivenPrice } from "@/components/vault";
import type { Tier } from "@/lib/grading/config";

export interface RivenCardStat { key: string; tier: Tier | null; name: string; value: string; negative: boolean }

/** One riven in the My Rivens grid: who it is, its stats in two aligned columns, and its estimated price. */
export function RivenCard({ id, weapon, rivenName, meta, stats }: { id: string; weapon: string; rivenName: string | null; meta: string; stats: RivenCardStat[] }) {
  return (
    <Link href={`/rivens/${id}`} className="tile block h-full">
      <h2 className="truncate font-display text-xl font-bold uppercase tracking-wide">{weapon}</h2>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm">
        {rivenName && <span className="font-semibold text-violet">{rivenName}</span>}
        <span className="text-dim">{meta}</span>
      </p>
      <ul className="mt-3 divide-y divide-line/70">
        {stats.map((s) => (
          <li key={s.key} className="flex items-center gap-3 py-1.5">
            <GradeBadge size="sm" tier={s.tier} />
            <span className={`min-w-0 flex-1 truncate text-[0.95rem] ${s.negative ? "text-danger" : "text-ink"}`}>{s.name}{s.negative && <span className="ml-1.5 text-xs text-danger/80">curse</span>}</span>
            <span className={`shrink-0 font-mono text-[0.95rem] tabular-nums ${s.negative ? "text-danger" : "text-ink"}`}>{s.value}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 border-t border-line pt-1"><RivenPrice id={id} /></div>
    </Link>
  );
}
