import { FlipList } from "@/components/flip-list";
import { PageHeader } from "@/components/page-header";
import { PriceRefresher } from "@/components/price-refresher";
import { PrimesTabs } from "@/components/primes-tabs";
import { listItemPrices } from "@/lib/data";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { itemsDue } from "@/lib/primes/due";
import { findFlips } from "@/lib/primes/flips";

export const metadata = { title: "Set flips" };

export default async function FlipsPage() {
  const prices = await listItemPrices();
  const by = new Map(prices.map((p) => [p.slug, p]));
  const flips = findFlips(primeCatalogue.parts, (s) => { const p = by.get(s); return p ? { price: p.avg5, listings: p.listings } : undefined; });
  return (
    <div className="space-y-5">
      <PageHeader kicker="Prime market" title="Set flips" />
      <PrimesTabs active="flips" />
      <PriceRefresher due={itemsDue(primeCatalogue.parts.map((p) => p.slug), prices)} endpoint="/api/primes/prices/refresh" />
      <FlipList flips={flips} />
    </div>
  );
}
