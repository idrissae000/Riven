import Link from "next/link";
import { currentUserId, getGradeRanges, getReferenceData } from "@/lib/data";
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

  const [ref, ranges, userId] = await Promise.all([getReferenceData(), getGradeRanges([riven.weapon_slug]), currentUserId()]);
  const weapon = ref.weapons.find((w) => w.slug === riven.weapon_slug);
  const attr = new Map(ref.attributes.map((a) => [a.slug, a]));
  const grades = gradeRiven(riven, weapon?.name ?? riven.weapon_slug, attr, ranges);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/rivens/new" className="text-sm text-dim hover:text-teal">← Check another</Link>
        <span className="chip">not saved</span>
      </div>

      <section className="card-glow">
        <h1 className="h-display text-3xl">{weapon?.name ?? riven.weapon_slug} <span className="text-violet">{riven.riven_name}</span></h1>
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
