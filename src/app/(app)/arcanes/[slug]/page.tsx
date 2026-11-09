import { notFound } from "next/navigation";
import { getArcane } from "@/lib/data";
import { ArcaneDetailView } from "@/components/arcane-detail";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const a = await getArcane((await params).slug);
  return { title: a?.name ?? "Arcane" };
}

export default async function ArcaneDetail({ params }: { params: Promise<{ slug: string }> }) {
  const a = await getArcane((await params).slug);
  if (!a) notFound();
  return <ArcaneDetailView a={a} />;
}
