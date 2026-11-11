import { PageHeader } from "@/components/page-header";
import { PrimesTabs } from "@/components/primes-tabs";
import { PriceRefresher } from "@/components/price-refresher";
import { RelicTable, type RelicRow } from "@/components/relic-table";
import { listItemPrices } from "@/lib/data";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { itemsDue } from "@/lib/primes/due";
import { REFINEMENTS, relicValue } from "@/lib/primes/relic-value";

export const metadata = { title: "Best relics" };

export default async function RelicsPage() {
  const prices = await listItemPrices();
  const priceOf = new Map(prices.map((p) => [p.slug, p.avg5]));
  const names = Object.fromEntries(primeCatalogue.parts.map((p) => [p.slug, p.name]));
  const relics: RelicRow[] = primeCatalogue.relics.map((r) => {
    const v = relicValue(r, (slug) => priceOf.get(slug) ?? null);
    return { id: r.id, name: r.name, era: r.era, vaulted: r.vaulted, ev: REFINEMENTS.map((f) => v.ev[f.id]), unpriced: v.unpriced, drops: v.drops };
  });
  // only parts that relics actually drop need prices for this page; the parts list refreshes all of them
  const due = itemsDue(primeCatalogue.parts.map((p) => p.slug), prices);
  return (
    <div className="space-y-5">
      <PageHeader kicker="Prime market" title="Best relics" />
      <PrimesTabs active="relics" />
      <PriceRefresher due={due} endpoint="/api/primes/prices/refresh" />
      <RelicTable relics={relics} names={names} />
    </div>
  );
}
