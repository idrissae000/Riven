import Link from "next/link";
import { currentUserId, listRivens, getReferenceData, getGradingData } from "@/lib/data";
import { gradeRiven } from "@/lib/grading/grade";
import { RivenCard } from "@/components/riven-card";
import { fmtStat } from "@/lib/format";
import { GuestHero } from "@/components/guest-hero";
import { PageHeader } from "@/components/page-header";
import { RivensTabs } from "@/components/rivens-tabs";
import { VaultProvider, VaultWorth } from "@/components/vault";
import type { VaultEstimate } from "@/lib/vault";

export const metadata = { title: "Rivens" };

export default async function RivensPage() {
  if (!(await currentUserId())) return <GuestHero />;
  const [rivens, ref] = await Promise.all([listRivens(), getReferenceData()]);
  const weapon = new Map(ref.weapons.map((w) => [w.slug, w]));
  const attr = new Map(ref.attributes.map((a) => [a.slug, a]));
  const gradingData = await getGradingData();
  const gradesById = new Map(
    rivens.map((r) => [r.id, weapon.has(r.weapon_slug) ? gradeRiven(r, weapon.get(r.weapon_slug)!, attr, gradingData) : []]),
  );

  const initialEstimates: Record<string, VaultEstimate> = Object.fromEntries(
    rivens.map((r) => [r.id, { low: r.est_low ?? null, median: r.est_median ?? null, high: r.est_high ?? null, confidence: r.est_confidence ?? null, at: r.est_at ?? null }]),
  );

  return (
    <VaultProvider initial={initialEstimates}>
    <div className="space-y-5">
      <PageHeader kicker="Your vault" title="My Rivens">
        <Link href="/rivens/new" className="btn-primary">+ New riven</Link>
      </PageHeader>
      <RivensTabs active="mine" />

      {ref.weapons.length === 0 && (
        <p className="card border-orange/40 text-sm text-orange">
          No weapons loaded yet. Run <code>npm run sync:wfm-static</code> to import weapons and riven stats.
        </p>
      )}

      {rivens.length > 0 && <VaultWorth />}

      {rivens.length === 0 ? (
        <div className="card text-center text-dim">
          <p className="mb-3">No rivens yet.</p>
          <Link href="/rivens/new" className="btn-primary">Add your first riven</Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rivens.map((r) => (
            <li key={r.id}>
              <RivenCard
                id={r.id}
                weapon={weapon.get(r.weapon_slug)?.name ?? r.weapon_slug}
                rivenName={r.riven_name}
                meta={`${r.polarity[0].toUpperCase() + r.polarity.slice(1)} · MR ${r.mastery_rank} · ${r.rerolls} rerolls`}
                stats={r.stats.flatMap((s, i) => {
                  const g = gradesById.get(r.id)![i];
                  return g ? [{ key: s.stat, tier: g.tier, name: attr.get(s.stat)?.name ?? s.stat, value: fmtStat(s.value, attr.get(s.stat)?.unit), negative: s.is_negative }] : [];
                })}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
    </VaultProvider>
  );
}
