import { PageHeader } from "@/components/page-header";
import { RivenForm } from "@/components/riven-form";
import { currentUserId, getReferenceData } from "@/lib/data";

export const metadata = { title: "Check a riven" };

export default async function NewRivenPage() {
  const [{ weapons, attributes }, userId] = await Promise.all([getReferenceData(), currentUserId()]);
  const signedIn = !!userId;
  return (
    <div className="space-y-5">
      <PageHeader kicker={signedIn ? "Add to your vault" : "Riven checker"} title={signedIn ? "New riven" : "Check a riven"} />
      {!signedIn && <p className="text-sm text-dim">Enter the stats to see a per-stat grade and a market estimate — no account needed, nothing is saved. <a className="text-teal hover:underline" href="/login">Sign in</a> if you want to save rivens.</p>}
      <RivenForm weapons={weapons} attributes={attributes} signedIn={signedIn} />
    </div>
  );
}
