import { Countdown } from "@/components/countdown";
import { PageHeader } from "@/components/page-header";
import { VarziaPast, type PastRotation } from "@/components/varzia-past";
import { VarziaRelics, type PackRow } from "@/components/varzia-relics";
import { listItemPrices } from "@/lib/data";
import type { SalesDay } from "@/lib/history-sales";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { createClient } from "@/lib/supabase/server";
import { rotationOutcome } from "@/lib/varzia/history";
import { parseRelicPack, relicPool, valuePool } from "@/lib/varzia/relics";
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
    const priceBy = new Map((await listItemPrices()).map((p) => [p.slug, p]));
    // a part counts only with 3+ online sellers: one lonely listing says nothing about its price
    const priceOf = (slug: string) => { const p = priceBy.get(slug); return p && p.listings >= 3 ? p.avg5 : null; };
    const packs: PackRow[] = [];
    const others: { name: string; cost: string }[] = [];
    for (const i of vz.items) {
      const pack = parseRelicPack(i.item);
      if (!pack) { others.push({ name: i.item, cost: i.regal != null ? `${i.regal} Regal Aya` : i.aya != null ? `${i.aya} Aya` : "—" }); continue; }
      const pool = relicPool(primeCatalogue.relics, primeCatalogue.parts, pack.era, pack.frames);
      const v = valuePool(pool, primeCatalogue.parts, pack.refinement, priceOf);
      packs.push({ name: i.item, era: pack.era, vault: pack.vault, colour: pack.colour, refinement: pack.refinement, aya: i.aya, pool: v.relics, avg: v.avg });
    }
    body = (
      <>
        <section className="card flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm"><b>{vz.location}</b> <span className="text-dim">· this rotation ends in <Countdown to={vz.expiry} /></span></p>
          <p className="text-xs text-dim">{vz.items.length} items</p>
        </section>
        <VarziaRelics packs={packs} others={others} />
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
