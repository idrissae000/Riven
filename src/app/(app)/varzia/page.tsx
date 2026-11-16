import { Countdown } from "@/components/countdown";
import { PageHeader } from "@/components/page-header";
import { VarziaPast, type PastRotation } from "@/components/varzia-past";
import { VarziaPicks, type VarziaRow } from "@/components/varzia-picks";
import { listItemPrices } from "@/lib/data";
import type { SalesDay } from "@/lib/history-sales";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { createClient } from "@/lib/supabase/server";
import { rotationOutcome } from "@/lib/varzia/history";
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

  // earlier rotations (every one is saved while it runs), with how each set's price moved after she left
  const sb = await createClient();
  const { data: past } = await sb.from("varzia_items").select("visit,ends,name,regal,slug,set_name").order("visit", { ascending: false }).limit(600);
  const finished = ((past ?? []) as { visit: string; ends: string | null; name: string; regal: number | null; slug: string | null; set_name: string | null }[]).filter((r) => r.ends && Date.parse(r.ends) < new Date().getTime());
  const pastSlugs = [...new Set(finished.flatMap((r) => (r.slug ? [r.slug] : [])))];
  const pastSales = new Map<string, SalesDay[]>();
  if (pastSlugs.length) {
    const { data } = await sb.from("sales_history").select("slug,day,avg_price,min_price,max_price,volume").in("slug", pastSlugs).order("day").limit(5000);
    for (const x of (data ?? []) as Record<string, unknown>[]) { const l = pastSales.get(x.slug as string) ?? []; l.push({ day: x.day as string, avg: Number(x.avg_price), min: x.min_price == null ? null : Number(x.min_price), max: x.max_price == null ? null : Number(x.max_price), volume: Number(x.volume ?? 0) }); pastSales.set(x.slug as string, l); }
  }
  const nowMs = new Date().getTime();
  const rotations: PastRotation[] = [];
  for (const r of finished) {
    let rot = rotations.find((x) => x.visit === r.visit);
    if (!rot) { rot = { visit: r.visit, ends: r.ends, sets: [] }; rotations.push(rot); }
    if (r.slug && r.set_name) rot.sets.push({ name: r.set_name, regal: r.regal, outcome: rotationOutcome(pastSales.get(r.slug) ?? [], r.ends as string, nowMs) });
  }
  for (const r of rotations) r.sets.sort((a, b) => (b.outcome?.changePct ?? -999) - (a.outcome?.changePct ?? -999));

  return (
    <div className="space-y-5">
      <PageHeader kicker="Prime Resurgence" title="Varzia" />
      {body}
      <VarziaPast rotations={rotations.filter((r) => r.sets.length > 0)} />
    </div>
  );
}
