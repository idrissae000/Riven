import { PageHeader } from "@/components/page-header";
import { PrimesTabs } from "@/components/primes-tabs";
import { PriceRefresher } from "@/components/price-refresher";
import { PrimeParts, type PartRow } from "@/components/prime-parts";
import { listItemPrices, listPriceHistory } from "@/lib/data";
import { trendOf } from "@/lib/history";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { itemsDue } from "@/lib/primes/due";

export const metadata = { title: "Prime parts" };

export default async function PrimesPage() {
  const [prices, history] = await Promise.all([listItemPrices(), listPriceHistory(14)]);
  const priceOf = new Map(prices.map((p) => [p.slug, p]));
  const rows: PartRow[] = primeCatalogue.parts.map((p) => {
    const price = priceOf.get(p.slug);
    return {
      slug: p.slug, name: p.name, kind: p.kind, type: p.type, ducats: p.ducats, vaulted: p.vaulted, relicCount: p.relics.length,
      price: price?.avg5 ?? null, low: price?.low ?? null, listings: price?.listings ?? 0, fetched: !!price?.fetched_at, trend: trendOf(history.get(p.slug)),
    };
  });
  const due = itemsDue(primeCatalogue.parts.map((p) => p.slug), prices);
  return (
    <div className="space-y-5">
      <PageHeader kicker="Prime market" title="Prime parts" />
      <PrimesTabs active="parts" />
      <PriceRefresher due={due} endpoint="/api/primes/prices/refresh" />
      <PrimeParts rows={rows} />
    </div>
  );
}
