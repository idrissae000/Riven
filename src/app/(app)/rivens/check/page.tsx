import Link from "next/link";
import { currentUserId, getGradingData, getReferenceData } from "@/lib/data";
import { gradeRiven } from "@/lib/grading/grade";
import { decodeRiven } from "@/lib/riven-share";
import { MarketEstimate } from "@/components/market-estimate";
import { RivenStats } from "@/components/riven-stats";
import { SaveOrSignIn } from "./save-or-signin";

export const metadata = { title: "Riven check" };

export default async function CheckPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  const riven = decodeRiven(r);
  if (!riven)
    return (
      <div className="card space-y-3 text-center">
        <p className="text-dim">That riven link isn’t valid.</p>
        <Link href="/rivens/new" className="btn-primary">Check a riven</Link>
      </div>
    );

  const [ref, gradingData, userId] = await Promise.all([getReferenceData(), getGradingData(), currentUserId()]);
  const weapon = ref.weapons.find((w) => w.slug === riven.weapon_slug);
  const attr = new Map(ref.attributes.map((a) => [a.slug, a]));
  const grades = weapon ? gradeRiven(riven, weapon, attr, gradingData) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/rivens/new" className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-dim hover:text-gold">← Check another</Link>
        <span className="chip">not saved</span>
      </div>

      <section className="card-glow">
        <h1 className="h-display text-[1.9rem]">{weapon?.name ?? riven.weapon_slug} <span className="text-violet">{riven.riven_name}</span></h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="chip">{riven.polarity}</span>
          <span className="chip">MR {riven.mastery_rank}</span>
          <span className="chip">Rank {riven.rank}</span>
          <span className="chip">{riven.rerolls} re-rolls</span>
        </div>
        <RivenStats stats={riven.stats} attrs={attr} grades={grades} />
      </section>

      <MarketEstimate endpoint={`/api/market/riven?r=${r}`} attrs={Object.fromEntries(ref.attributes.map((a) => [a.slug, { name: a.name, unit: a.unit }]))} />
      <SaveOrSignIn riven={riven} signedIn={!!userId} nextPath={`/rivens/check?r=${r}`} />
    </div>
  );
}
