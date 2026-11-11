import { LiveView } from "@/components/live-view";
import { PageHeader } from "@/components/page-header";
import { getWorldState } from "@/lib/worldstate";

export const metadata = { title: "Live" };
export const dynamic = "force-dynamic";

export default async function LivePage() {
  const { state: ws, stale } = await getWorldState();
  return (
    <div className="space-y-5">
      <PageHeader kicker="World state" title="Live" />
      {!ws ? (
        <p className="card text-sm text-dim">The world state feed isn’t answering right now. Try again in a minute.</p>
      ) : (
        <>
          {stale && <p className="text-xs text-orange">The live feed didn’t answer, so this is the last copy we have (from {new Date(ws.fetchedAt).toUTCString()}).</p>}
          <LiveView ws={ws} />
          <p className="text-xs text-dim">Data from api.warframestat.us, refreshed about once a minute.</p>
        </>
      )}
    </div>
  );
}
