import { PageHeader } from "@/components/page-header";
import { listArcaneCollections, listArcanePrices, listArcanes } from "@/lib/data";
import { ArcaneTabs } from "@/components/arcane-tabs";
import { ArcanePriceRefresher } from "@/components/arcane-price-refresher";
import { VosforCollections, type CollectionCard } from "@/components/vosfor-collections";
import { valueCollection } from "@/lib/arcanes/collection-value";
import { arcanesDue } from "@/lib/arcanes/due";

export const metadata = { title: "Vosfor collections" };

export default async function VosforPage() {
  const [collections, arcanes, prices] = await Promise.all([listArcaneCollections(), listArcanes(), listArcanePrices()]);
  const priceOf = new Map(prices.map((p) => [p.slug, p]));
  const names = Object.fromEntries(arcanes.map((a) => [a.slug, a.name]));
  const cards: CollectionCard[] = collections.map((c) => ({
    id: c.id, name: c.name, vosfor: c.vosfor, credits: c.credits, picks: c.picks,
    value: valueCollection(c, (slug) => { const p = priceOf.get(slug); return p ? { avg5: p.avg5, low: p.low, listings: p.listings } : undefined; }),
  }));
  const due = arcanesDue(arcanes, prices);

  return (
    <div className="space-y-5">
      <PageHeader kicker="Loid · Albrecht’s Laboratories" title="Vosfor collections" />
      <ArcaneTabs active="vosfor" />
      <ArcanePriceRefresher due={due} />
      {cards.length === 0 ? (
        <p className="card border-orange/40 text-sm text-orange">No collections loaded yet. Run <code>npm run sync:wiki-arcanes</code> to import them from the Warframe Wiki.</p>
      ) : (
        <VosforCollections cards={cards} names={names} />
      )}
    </div>
  );
}
