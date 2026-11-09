import { PageHeader } from "@/components/page-header";
import { listArcanes } from "@/lib/data";
import { ArcaneBrowser, type ArcaneListItem } from "@/components/arcane-browser";

export const metadata = { title: "Arcanes" };

export default async function ArcanesPage() {
  const arcanes = await listArcanes();
  const items: ArcaneListItem[] = arcanes.map((a) => ({
    slug: a.slug, name: a.name, slot: a.slot, rarity: a.rarity, description: a.description,
    categories: a.compatibility?.categories ?? [], ability_scaling: !!a.compatibility?.ability_scaling, scales_with: a.compatibility?.scales_with ?? [],
  }));
  return (
    <div className="space-y-5">
      <PageHeader kicker="Arcane archive" title="Arcanes" />
      {arcanes.length === 0 ? (
        <p className="card border-orange/40 text-sm text-orange">No arcanes loaded yet. Run <code>npm run sync:wiki-arcanes</code> to import them from the Warframe Wiki.</p>
      ) : (
        <ArcaneBrowser items={items} />
      )}
    </div>
  );
}
