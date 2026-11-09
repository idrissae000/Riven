import Link from "next/link";
import { notFound } from "next/navigation";
import { getReferenceData, getRiven } from "@/lib/data";
import { fmtStat } from "@/lib/format";
import { DeleteRivenButton } from "./delete-button";

export default async function RivenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [riven, ref] = await Promise.all([getRiven(id), getReferenceData()]);
  if (!riven) notFound();
  const weapon = ref.weapons.find((w) => w.slug === riven.weapon_slug);
  const attr = new Map(ref.attributes.map((a) => [a.slug, a]));

  return (
    <div className="space-y-5">
      <Link href="/rivens" className="text-sm text-dim hover:text-teal">← All rivens</Link>
      <section className="card-glow">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="h-display text-3xl">{weapon?.name ?? riven.weapon_slug} <span className="text-violet">{riven.riven_name}</span></h1>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="chip">{riven.polarity}</span>
          <span className="chip">MR {riven.mastery_rank}</span>
          <span className="chip">Rank {riven.rank}</span>
          <span className="chip">{riven.rerolls} re-rolls</span>
          {weapon?.disposition != null && <span className="chip">disposition {weapon.disposition}</span>}
        </div>
        <ul className="mt-4 divide-y divide-line">
          {riven.stats.map((s) => (
            <li key={s.stat} className="flex items-center justify-between py-2.5">
              <span className="text-dim">{attr.get(s.stat)?.name ?? s.stat}</span>
              <span className={`font-mono text-lg ${s.is_negative ? "text-danger" : "text-ink"}`}>{fmtStat(s.value, attr.get(s.stat)?.unit)}</span>
            </li>
          ))}
        </ul>
        {riven.notes && <p className="mt-3 text-sm text-dim">{riven.notes}</p>}
      </section>
      <div className="flex gap-3">
        <Link href={`/rivens/${riven.id}/edit`} className="btn flex-1">Edit</Link>
        <DeleteRivenButton id={riven.id} />
      </div>
    </div>
  );
}
