import Link from "next/link";
import { notFound } from "next/navigation";
import { getGradingData, getReferenceData, getRiven } from "@/lib/data";
import { gradeRiven } from "@/lib/grading/grade";
import { PushToWfm } from "@/components/push-to-wfm";
import { RivenStats } from "@/components/riven-stats";
import { DeleteRivenButton } from "./delete-button";
import { MarketEstimate } from "@/components/market-estimate";

export default async function RivenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [riven, ref] = await Promise.all([getRiven(id), getReferenceData()]);
  if (!riven) notFound();
  const weapon = ref.weapons.find((w) => w.slug === riven.weapon_slug);
  const attr = new Map(ref.attributes.map((a) => [a.slug, a]));
  const grades = weapon ? gradeRiven(riven, weapon, attr, await getGradingData()) : [];

  return (
    <div className="space-y-5">
      <Link href="/rivens" className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-dim hover:text-gold">← All rivens</Link>
      <section className="card-glow">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="h-display text-[1.9rem]">{weapon?.name ?? riven.weapon_slug} <span className="text-violet">{riven.riven_name}</span></h1>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="chip">{riven.polarity}</span>
          <span className="chip">MR {riven.mastery_rank}</span>
          <span className="chip">Rank {riven.rank}</span>
          <span className="chip">{riven.rerolls} re-rolls</span>
          {weapon?.disposition != null && <span className="chip">disposition {weapon.disposition}</span>}
        </div>
        <RivenStats stats={riven.stats} attrs={attr} grades={grades} />
        {riven.notes && <p className="mt-3 text-sm text-dim">{riven.notes}</p>}
      </section>
      <MarketEstimate endpoint={`/api/rivens/${riven.id}/market`} attrs={Object.fromEntries(ref.attributes.map((a) => [a.slug, { name: a.name, unit: a.unit }]))} />
      <PushToWfm
        rivenId={riven.id}
        label={`${weapon?.name ?? riven.weapon_slug} ${riven.riven_name ?? ""}`.trim()}
        hasName={!!riven.riven_name?.trim()}
        listed={riven.wfm_auction_id ? { auctionId: riven.wfm_auction_id, price: riven.wfm_price ?? null } : null}
      />
      <div className="flex gap-3">
        <Link href={`/rivens/${riven.id}/edit`} className="btn flex-1">Edit</Link>
        <DeleteRivenButton id={riven.id} />
      </div>
    </div>
  );
}
