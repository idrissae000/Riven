import { InventoryScan, type PartInfo } from "@/components/inventory-scan";
import { PageHeader } from "@/components/page-header";
import { PriceRefresher } from "@/components/price-refresher";
import { InventoryTabs } from "@/components/inventory-tabs";
import { currentUserId, listArcanePrices, listArcanes, listItemPrices } from "@/lib/data";
import { ScanSwitcher } from "@/components/scan-switcher";
import { arcanesDue } from "@/lib/arcanes/due";
import { priceView } from "@/lib/arcanes/price-view";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { itemsDue } from "@/lib/primes/due";
import { setDefs } from "@/lib/primes/set-defs";

export const metadata = { title: "Scan inventory" };

export default async function ScanPage() {
  const [prices, uid, arcanes, arcanePrices] = await Promise.all([listItemPrices(), currentUserId(), listArcanes(), listArcanePrices()]);
  const priceOf = new Map(prices.map((p) => [p.slug, p]));
  const info: Record<string, PartInfo> = {};
  for (const p of primeCatalogue.parts) info[p.slug] = { name: p.name, price: priceOf.get(p.slug)?.avg5 ?? null, ducats: p.ducats };
  const arcanePrice = new Map(arcanePrices.map((p) => [p.slug, p]));
  const arcaneInfo: Record<string, PartInfo> = {};
  for (const a of arcanes) {
    const row = arcanePrice.get(a.slug);
    arcaneInfo[a.slug] = { name: a.name, price: priceView(row, a.max_rank)?.price ?? null, ducats: null, maxRank: a.max_rank, priceMax: row?.max_avg5 ?? null };
  }
  const due = itemsDue(primeCatalogue.parts.map((p) => p.slug), prices);
  return (
    <div className="space-y-5">
      <PageHeader kicker="Your stuff" title="Inventory" />
      <InventoryTabs active="scan" />
      <PriceRefresher due={due} endpoint="/api/primes/prices/refresh" />
      <PriceRefresher due={arcanesDue(arcanes, arcanePrices)} endpoint="/api/arcanes/prices/refresh" />
      <ScanSwitcher
        prime={<InventoryScan kind="prime" info={info} signedIn={!!uid} sets={setDefs(primeCatalogue.parts)} setPrices={Object.fromEntries(primeCatalogue.parts.filter((p) => p.kind === "set" && priceOf.get(p.slug)?.avg5 != null).map((p) => [p.slug, priceOf.get(p.slug)!.avg5 as number]))} />}
        arcane={<InventoryScan kind="arcane" info={arcaneInfo} signedIn={!!uid} sets={[]} setPrices={{}} />}
      />
    </div>
  );
}
