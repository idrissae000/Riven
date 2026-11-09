import Link from "next/link";
import { currentUserId, listRivens, getReferenceData, getGradeRanges } from "@/lib/data";
import { gradeRiven } from "@/lib/grading/grade";
import { GradeBadge } from "@/components/grade-badge";
import { fmtStat } from "@/lib/format";
import { GuestHero } from "@/components/guest-hero";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Rivens" };

export default async function RivensPage() {
  if (!(await currentUserId())) return <GuestHero />;
  const [rivens, ref] = await Promise.all([listRivens(), getReferenceData()]);
  const weapon = new Map(ref.weapons.map((w) => [w.slug, w]));
  const attr = new Map(ref.attributes.map((a) => [a.slug, a]));
  const ranges = await getGradeRanges(rivens.map((r) => r.weapon_slug));
  const gradesById = new Map(
    rivens.map((r) => [r.id, gradeRiven(r, weapon.get(r.weapon_slug)?.name ?? r.weapon_slug, attr, ranges)]),
  );

  return (
    <div className="space-y-5">
      <PageHeader kicker="Your vault" title="My Rivens">
        <Link href="/rivens/new" className="btn-primary">+ New riven</Link>
      </PageHeader>

      {ref.weapons.length === 0 && (
        <p className="card border-orange/40 text-sm text-orange">
          No weapons loaded yet. Run <code>npm run sync:wfm-static</code> to import weapons and riven stats.
        </p>
      )}

      {rivens.length === 0 ? (
        <div className="card text-center text-dim">
          <p className="mb-3">No rivens yet.</p>
          <Link href="/rivens/new" className="btn-primary">Add your first riven</Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rivens.map((r) => (
            <li key={r.id}>
              <Link href={`/rivens/${r.id}`} className="card block">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="h-display text-xl">{weapon.get(r.weapon_slug)?.name ?? r.weapon_slug}</span>
                  <span className="font-display text-sm font-semibold tracking-wide text-violet">{r.riven_name}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-dim">
                  <span className="chip">{r.polarity}</span>
                  <span className="chip">MR {r.mastery_rank}</span>
                  <span className="chip">{r.rerolls} rerolls</span>
                </div>
                <ul className="mt-3 space-y-1 font-mono text-sm">
                  {r.stats.map((s, i) => {
                    const g = gradesById.get(r.id)![i];
                    return (
                      <li key={s.stat} className={`flex items-center gap-2 ${s.is_negative ? "text-danger" : "text-ink"}`}>
                        <GradeBadge size="sm" tier={g.tier} placeholder={g.placeholder} />
                        <span>{fmtStat(s.value, attr.get(s.stat)?.unit)} <span className="font-sans text-dim">{attr.get(s.stat)?.name ?? s.stat}</span></span>
                      </li>
                    );
                  })}
                </ul>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
