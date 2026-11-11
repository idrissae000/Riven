import { PageHeader } from "@/components/page-header";
import { PriceRefresher } from "@/components/price-refresher";
import { RivensTabs } from "@/components/rivens-tabs";
import { WeaponRanking, type WeaponRow } from "@/components/weapon-ranking";
import { getReferenceData, listWeaponRivenPrices } from "@/lib/data";
import { weaponsDue } from "@/lib/rivens/due";

export const metadata = { title: "Weapon ranking" };

export default async function WeaponRankingPage() {
  const [ref, prices] = await Promise.all([getReferenceData(), listWeaponRivenPrices()]);
  const statName = new Map(ref.attributes.map((a) => [a.slug, a.name]));
  const priceOf = new Map(prices.map((p) => [p.slug, p]));
  const rows: WeaponRow[] = ref.weapons.map((w) => {
    const p = priceOf.get(w.slug);
    return {
      slug: w.slug, name: w.name, type: w.group_name === "archgun" ? "archgun" : w.riven_type, group: w.group_name,
      listings: p?.listings ?? 0, saturated: p?.saturated ?? false, low: p?.low ?? null, median: p?.median ?? null, p75: p?.p75 ?? null,
      stats: (p?.stats ?? []).map((s) => ({ name: statName.get(s.stat) ?? s.stat, withMedian: s.withMedian, withoutMedian: s.withoutMedian, n: s.n })),
      fetched: !!p?.fetched_at,
    };
  });
  const due = weaponsDue(ref.weapons, prices);
  return (
    <div className="space-y-5">
      <PageHeader kicker="Riven market" title="Weapon ranking" />
      <RivensTabs active="weapons" />
      <PriceRefresher due={due} endpoint="/api/weapons/prices/refresh" />
      <WeaponRanking rows={rows} />
    </div>
  );
}
