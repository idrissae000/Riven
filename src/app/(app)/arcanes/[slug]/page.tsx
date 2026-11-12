import { notFound } from "next/navigation";
import { getArcane, getItemHistory } from "@/lib/data";
import { PriceChart } from "@/components/price-chart";
import { ArcaneDetailView } from "@/components/arcane-detail";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const a = await getArcane((await params).slug);
  return { title: a?.name ?? "Arcane" };
}

export default async function ArcaneDetail({ params }: { params: Promise<{ slug: string }> }) {
  const a = await getArcane((await params).slug);
  if (!a) notFound();
  const h = a.wfm_slug ? await getItemHistory(a.slug) : null;
  return <ArcaneDetailView a={a} chart={h && <PriceChart name={a.name} sales={h.sales} asking={h.asking} />} />;
}
