import Link from "next/link";
import { notFound } from "next/navigation";
import { Plat } from "@/components/brand";
import { PageHeader } from "@/components/page-header";
import { PriceChart } from "@/components/price-chart";
import { getItemHistory, listItemPrices } from "@/lib/data";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { ducatVerdict } from "@/lib/primes/ducats";

const part = (slug: string) => primeCatalogue.parts.find((p) => p.slug === slug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return { title: part((await params).slug)?.name ?? "Prime part" };
}

export default async function PrimePartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = part(slug);
  if (!p) notFound();
  const [history, prices] = await Promise.all([getItemHistory(slug), listItemPrices()]);
  const price = prices.find((x) => x.slug === slug);
  const verdict = p.kind === "part" ? ducatVerdict(price?.avg5 ?? null, p.ducats) : null;
  const relics = p.relics.map((id) => primeCatalogue.relics.find((r) => r.id === id)).filter((r) => !!r);
  const set = p.setSlug ? part(p.setSlug) : null;
  const siblings = p.kind === "set" ? primeCatalogue.parts.filter((x) => x.setSlug === slug) : [];

  return (
    <div className="space-y-5">
      <PageHeader kicker="Prime market" title={p.name}>
        <Link href="/primes" className="btn">← All parts</Link>
      </PageHeader>

      <section className="card flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 text-sm text-dim">
          <p>{p.kind === "set" ? "Set" : p.type[0].toUpperCase() + p.type.slice(1) + " part"}{p.ducats != null && <> · {p.ducats} ducats</>}</p>
          <p>
            {p.vaulted === true && <span className="font-semibold text-orange">Vaulted</span>}
            {p.vaulted === false && <span className="font-semibold text-teal">Farmable from relics</span>}
            {p.vaulted === null && p.kind === "part" && <>Not a relic drop</>}
            {verdict === "ducat" && <> · <span className="font-semibold text-violet">better as ducats</span></>}
          </p>
          {set && <p>Part of <Link href={`/primes/${set.slug}`} className="text-gold underline">{set.name}</Link></p>}
        </div>
        <div className="text-right">
          {price?.avg5 != null ? (
            <>
              <p className="h-display flex items-center justify-end gap-1.5 text-3xl text-plat">{price.avg5} <Plat size={22} /></p>
              <p className="text-xs text-dim">average of the 5 cheapest online listings · low {price.low}{price.listings < 3 ? " · thin market" : ""}</p>
            </>
          ) : <span className="text-sm text-dim">no online listings</span>}
        </div>
      </section>

      <PriceChart slug={slug} name={p.name} sales={history.sales} asking={history.asking} />

      {siblings.length > 0 && (
        <section className="card space-y-2">
          <h2 className="kicker">Parts in this set</h2>
          <ul className="flex flex-wrap gap-2">{siblings.map((x) => <li key={x.slug}><Link href={`/primes/${x.slug}`} className="chip hover:text-gold">{x.perSet > 1 && `${x.perSet}× `}{x.name}</Link></li>)}</ul>
        </section>
      )}
      {relics.length > 0 && (
        <section className="card space-y-2">
          <h2 className="kicker">Dropped by</h2>
          <ul className="flex flex-wrap gap-2">{relics.map((r) => <li key={r.id} className={`chip ${r.vaulted ? "text-orange" : ""}`}>{r.name}{r.vaulted && " (vaulted)"}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
