import { RivenForm } from "@/components/riven-form";
import { getReferenceData } from "@/lib/data";

export const metadata = { title: "New riven" };

export default async function NewRivenPage() {
  const { weapons, attributes } = await getReferenceData();
  return (
    <div className="space-y-5">
      <h1 className="h-display text-3xl">New riven</h1>
      <RivenForm weapons={weapons} attributes={attributes} />
    </div>
  );
}
