import Link from "next/link";
import { InventoryManager, type AddOption } from "@/components/inventory-manager";
import { PageHeader } from "@/components/page-header";
import { PriceRefresher } from "@/components/price-refresher";
import { currentUserId, listArcanePrices, listArcanes, listItemPrices } from "@/lib/data";
import { priceView } from "@/lib/arcanes/price-view";
import { setAdvice, valueInventory, type OwnedItem } from "@/lib/inventory/value";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { itemsDue } from "@/lib/primes/due";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  if (!(await currentUserId())) {
    return (
      <div className="space-y-5">
        <PageHeader kicker="Warframe Market" title="Inventory" />
        <div className="card space-y-3 text-sm text-dim">
          <p>Track the Prime parts and arcanes you own, see what they’re worth, and what’s best to sell. It’s saved to your Riven Buddy account (optional — everything else works without one).</p>
          <Link href="/login?next=/market/inventory" className="btn-primary">Sign in</Link>
        </div>
      </div>
    );
  }

  const sb = await createClient();
  const [{ data: rows }, itemPrices, arcanes, arcanePrices] = await Promise.all([
    sb.from("inventory_items").select("id,kind,slug,rank,qty").order("created_at", { ascending: false }),
    listItemPrices(), listArcanes(), listArcanePrices(),
  ]);
  const owned = (rows ?? []) as OwnedItem[];
  const partBy = new Map(primeCatalogue.parts.map((p) => [p.slug, p]));
  const itemPrice = new Map(itemPrices.map((p) => [p.slug, p]));
  const arcaneBy = new Map(arcanes.map((a) => [a.slug, a]));
  const arcanePrice = new Map(arcanePrices.map((p) => [p.slug, p]));

  const value = valueInventory(owned, (i) => {
    if (i.kind === "prime") {
      const part = partBy.get(i.slug), p = itemPrice.get(i.slug);
      return part ? { name: part.name, price: p?.avg5 ?? null, ducats: part.ducats, note: p && p.listings > 0 && p.listings < 3 ? "thin market" : null } : undefined;
    }
    const a = arcaneBy.get(i.slug);
    if (!a) return undefined;
    const row = arcanePrice.get(i.slug);
    if (i.rank > 0) return { name: a.name, price: row?.max_avg5 ?? null, ducats: null, note: row && row.max_listings > 0 && row.max_listings < 3 ? "thin market" : null };
    const v = priceView(row, a.max_rank);
    return { name: a.name, price: v?.price ?? null, ducats: null, note: v?.basis === "derived" ? "derived from max rank" : v?.basis === "thin" ? "thin market" : null };
  });

  const primeQty = new Map<string, number>();
  for (const i of owned) if (i.kind === "prime") primeQty.set(i.slug, (primeQty.get(i.slug) ?? 0) + i.qty);
  const advice = setAdvice(primeQty, primeCatalogue.parts, (slug) => itemPrice.get(slug)?.avg5 ?? null);

  const options: AddOption[] = [
    ...primeCatalogue.parts.map((p): AddOption => ({ slug: p.slug, kind: "prime", name: p.name, maxRank: null })),
    ...arcanes.map((a): AddOption => ({ slug: a.slug, kind: "arcane", name: a.name, maxRank: a.max_rank })),
  ];
  const due = itemsDue(primeCatalogue.parts.map((p) => p.slug), itemPrices);

  return (
    <div className="space-y-5">
      <PageHeader kicker="Warframe Market" title="Inventory">
        <Link href="/market" className="btn">← Market</Link>
      </PageHeader>
      <PriceRefresher due={due} endpoint="/api/primes/prices/refresh" />
      <InventoryManager options={options} rows={value.rows} total={value.total} priced={value.priced} advice={advice} />
    </div>
  );
}
