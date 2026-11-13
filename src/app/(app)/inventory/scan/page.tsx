import { InventoryScan, type PartInfo } from "@/components/inventory-scan";
import { PageHeader } from "@/components/page-header";
import { PriceRefresher } from "@/components/price-refresher";
import { InventoryTabs } from "@/components/inventory-tabs";
import { currentUserId, listItemPrices } from "@/lib/data";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { itemsDue } from "@/lib/primes/due";

export const metadata = { title: "Scan inventory" };

export default async function ScanPage() {
  const [prices, uid] = await Promise.all([listItemPrices(), currentUserId()]);
  const priceOf = new Map(prices.map((p) => [p.slug, p]));
  const info: Record<string, PartInfo> = {};
  for (const p of primeCatalogue.parts) info[p.slug] = { name: p.name, price: priceOf.get(p.slug)?.avg5 ?? null, ducats: p.ducats };
  const due = itemsDue(primeCatalogue.parts.map((p) => p.slug), prices);
  return (
    <div className="space-y-5">
      <PageHeader kicker="Your stuff" title="Inventory" />
      <InventoryTabs active="scan" />
      <PriceRefresher due={due} endpoint="/api/primes/prices/refresh" />
      <InventoryScan info={info} signedIn={!!uid} />
    </div>
  );
}
