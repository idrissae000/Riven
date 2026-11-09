import { notFound } from "next/navigation";
import { RivenForm } from "@/components/riven-form";
import { getReferenceData, getRiven } from "@/lib/data";

export const metadata = { title: "Edit riven" };

export default async function EditRivenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [riven, ref] = await Promise.all([getRiven(id), getReferenceData()]);
  if (!riven) notFound();
  return (
    <div className="space-y-5">
      <h1 className="h-display text-3xl">Edit riven</h1>
      <RivenForm weapons={ref.weapons} attributes={ref.attributes} rivenId={riven.id} initial={riven} />
    </div>
  );
}
