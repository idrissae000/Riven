import { PageHeader } from "@/components/page-header";
import { listArcanePrices, listArcanes } from "@/lib/data";
import { ArcaneTabs } from "@/components/arcane-tabs";
import { PriceRefresher } from "@/components/price-refresher";
import { priceView } from "@/lib/arcanes/price-view";
import { sourceLabel } from "@/lib/arcanes/source-label";
import { arcanesDue } from "@/lib/arcanes/due";
import { timeAgo } from "@/lib/format";
import { ArcaneBrowser, type ArcaneListItem } from "@/components/arcane-browser";

export const metadata = { title: "Arcanes" };

export default async function ArcanesPage() {
  const [arcanes, prices] = await Promise.all([listArcanes(), listArcanePrices()]);
  const priceOf = new Map(prices.map((p) => [p.slug, p]));
  const items: ArcaneListItem[] = arcanes.map((a) => {
    const p = priceOf.get(a.slug);
    return {
      slug: a.slug, name: a.name, slot: a.slot, rarity: a.rarity, description: a.description,
      categories: a.compatibility?.categories ?? [], ability_scaling: !!a.compatibility?.ability_scaling, scales_with: a.compatibility?.scales_with ?? [],
      price: p ? priceView(p, a.max_rank) : null,
      source: sourceLabel(a.drop_sources),
    };
  });
  // how many arcanes are due a price / sales refresh (the client component works through them in the background)
  const due = arcanesDue(arcanes, prices);
  const oldest = prices.map((p) => p.fetched_at).filter((x): x is string => !!x).sort()[0];
  return (
    <div className="space-y-5">
      <PageHeader kicker="Arcane archive" title="Arcanes" />
      <ArcaneTabs active="arcanes" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PriceRefresher due={due} />
        {oldest && <p className="ml-auto text-xs text-dim">Prices as of {timeAgo(oldest)}</p>}
      </div>
      {arcanes.length === 0 ? (
        <p className="card border-orange/40 text-sm text-orange">No arcanes loaded yet. Run <code>npm run sync:wiki-arcanes</code> to import them from the Warframe Wiki.</p>
      ) : (
        <ArcaneBrowser items={items} />
      )}
    </div>
  );
}
