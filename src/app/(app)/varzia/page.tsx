import { Countdown } from "@/components/countdown";
import { PageHeader } from "@/components/page-header";
import { VarziaPicks, type VarziaRow } from "@/components/varzia-picks";
import { listItemPrices } from "@/lib/data";
import type { SalesDay } from "@/lib/history-sales";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { createClient } from "@/lib/supabase/server";
import { setNameFor } from "@/lib/varzia/map";
import { getWorldState } from "@/lib/worldstate";

export const metadata = { title: "Varzia — Prime Resurgence" };

export default async function VarziaPage() {
  const { state } = await getWorldState();
  const vz = state?.varzia ?? null;
  const here = !!vz && !!state && vz.items.length > 0 && Date.parse(vz.activation) <= Date.parse(state.fetchedAt);

  let body: React.ReactNode;
  if (!state) body = <p className="card text-sm text-dim">Couldn’t load the world-state feed right now. Try again in a minute.</p>;
  else if (!vz || !here) body = (
    <div className="card space-y-1 text-sm">
      <p className="text-ink">Varzia’s Prime Resurgence isn’t running right now.</p>
      <p className="text-dim">{vz ? <>It starts in <Countdown to={vz.activation} />.</> : "Her stock and the price tracking appear here when a rotation starts."}</p>
    </div>
  );
  else {
    const sets = new Map(primeCatalogue.parts.filter((p) => p.kind === "set").map((p) => [p.name.toLowerCase(), p]));
    const prices = new Map((await listItemPrices()).map((p) => [p.slug, p]));
    const rows: VarziaRow[] = vz.items.map((i) => {
      const wanted = setNameFor(i.item);
      const set = wanted ? sets.get(wanted.toLowerCase()) : undefined;
      const ip = set ? prices.get(set.slug) : undefined;
      return { name: i.item, regal: i.regal, aya: i.aya, slug: set?.slug ?? null, setName: set?.name ?? null, askNow: ip?.avg5 ?? null, listings: ip?.listings ?? 0 };
    });
    const history: Record<string, SalesDay[]> = {};
    const slugs = rows.flatMap((r) => (r.slug ? [r.slug] : []));
    if (slugs.length) {
      const sb = await createClient();
      const since = new Date(Date.parse(vz.activation) - 100 * 86_400_000).toISOString().slice(0, 10);
      const { data } = await sb.from("sales_history").select("slug,day,avg_price,min_price,max_price,volume").in("slug", slugs).gte("day", since).order("day").limit(5000);
      for (const s of (data ?? []) as Record<string, unknown>[]) (history[s.slug as string] ??= []).push({ day: s.day as string, avg: Number(s.avg_price), min: s.min_price == null ? null : Number(s.min_price), max: s.max_price == null ? null : Number(s.max_price), volume: Number(s.volume ?? 0) });
    }
    body = (
      <>
        <section className="card flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm"><b>{vz.location}</b> <span className="text-dim">· this rotation ends in <Countdown to={vz.expiry} /></span></p>
          <p className="text-xs text-dim">{vz.items.length} items</p>
        </section>
        <VarziaPicks rows={rows} history={history} activation={vz.activation} expiry={vz.expiry} />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader kicker="Prime Resurgence" title="Varzia" />
      {body}
    </div>
  );
}
