import { notFound } from "next/navigation";
import { getAbilitiesScalingWith, getArcane } from "@/lib/data";
import { modifiersFor } from "@/lib/abilities/build";
import { ArcaneDetailView } from "@/components/arcane-detail";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const a = await getArcane((await params).slug);
  return { title: a?.name ?? "Arcane" };
}

export default async function ArcaneDetail({ params }: { params: Promise<{ slug: string }> }) {
  const a = await getArcane((await params).slug);
  if (!a) notFound();
  const mods = modifiersFor(a.effect_stats.map((e) => e.key));
  const { abilities, unknownCount } = await getAbilitiesScalingWith(mods);
  return <ArcaneDetailView a={a} abilities={abilities} abilityStats={mods} unknownAbilityCount={unknownCount} />;
}
