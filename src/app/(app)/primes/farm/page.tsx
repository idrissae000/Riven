import { PageHeader } from "@/components/page-header";
import { PriceRefresher } from "@/components/price-refresher";
import { PrimesTabs } from "@/components/primes-tabs";
import { Plat } from "@/components/brand";
import { listArcanePrices, listArcanes, listItemPrices } from "@/lib/data";
import { priceView } from "@/lib/arcanes/price-view";
import rewards from "../../../../../data/mission-rewards.json";
import { rankMissions, type MissionRow, type RewardData } from "@/lib/farm/value";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { itemsDue } from "@/lib/primes/due";

export const metadata = { title: "Where to farm" };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default async function FarmPage() {
  const [prices, arcanes, arcanePrices] = await Promise.all([listItemPrices(), listArcanes(), listArcanePrices()]);
  const partBy = new Map(primeCatalogue.parts.map((p) => [p.name.toLowerCase(), p.slug]));
  const priceBy = new Map(prices.map((p) => [p.slug, p]));
  // a part counts only with 3+ online sellers: one lonely listing says nothing about its price
  const partPrice = (name: string) => { const slug = partBy.get(name.toLowerCase()); const p = slug ? priceBy.get(slug) : undefined; return p && p.listings >= 3 ? p.avg5 : null; };
  const arcaneBy = new Map(arcanes.map((a) => [a.name.toLowerCase(), a]));
  const arcanePriceBy = new Map(arcanePrices.map((p) => [p.slug, p]));
  const arcanePrice = (name: string) => { const a = arcaneBy.get(name.toLowerCase()); const row = a ? arcanePriceBy.get(a.slug) : undefined; return a && row && row.listings >= 3 ? priceView(row, a.max_rank)?.price ?? null : null; };

  const rows = rankMissions(rewards as unknown as RewardData, partPrice, arcanePrice);
  const endless = rows.filter((r) => r.cycle != null && r.cycle > 0).sort((a, b) => (b.cycle as number) - (a.cycle as number)).slice(0, 15);
  const single = rows.filter((r) => r.cycle == null && (r.run ?? 0) > 0).sort((a, b) => (b.run as number) - (a.run as number)).slice(0, 12);

  return (
    <div className="space-y-5">
      <PageHeader kicker="Prime market" title="Where to farm" />
      <PrimesTabs active="farm" />
      <PriceRefresher due={itemsDue(primeCatalogue.parts.map((p) => p.slug), prices)} endpoint="/api/primes/prices/refresh" />
      <section className="card space-y-1 text-sm text-dim">
        <p>Which missions drop the most platinum, from their real drop tables and today’s prices. Each reward is its drop chance × what it’s worth; a relic is worth the Prime parts it can open to (its Intact odds, with Forma counted as nothing), and an arcane is its rank-0 price.</p>
        <p><b className="text-ink">These are floors.</b> Only relics and arcanes are priced. Mods, resources, Endo and credits also drop but aren’t counted, so the real total is higher. Parts with fewer than 3 online sellers aren’t counted either. A relic still has to be cracked in a fissure to turn into platinum, which takes time this doesn’t count.</p>
        <p>Endless missions give rewards in rotations that go A, A, B, C and repeat, so their number is <b className="text-ink">per cycle of 4 rotations</b>. Drop tables from the community drop-data export, last updated {new Date(rewards.fetchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.</p>
      </section>

      <Section title="Endless missions — platinum per 4-rotation cycle" rows={endless} value={(r) => r.cycle as number} unit="per cycle" />
      <Section title="Other missions — platinum per run (best reward table)" rows={single} value={(r) => r.run as number} unit="per run" />
    </div>
  );
}

function Section({ title, rows, value, unit }: { title: string; rows: MissionRow[]; value: (r: MissionRow) => number; unit: string }) {
  return (
    <section className="space-y-2">
      <h2 className="kicker">{title}</h2>
      {rows.length === 0 ? <p className="card text-sm text-dim">Nothing to rank yet. Prices are still loading.</p> : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.planet}-${r.node}`} className="card space-y-1.5 !p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-ink"><span className="text-dim">{i + 1}.</span> {r.node} <span className="text-dim">· {r.planet} · {r.mode}</span></p>
                <span className="h-display flex items-center gap-1 text-lg text-plat">{fmt(value(r))} <Plat size={13} /> <span className="text-xs font-normal text-dim">{unit}</span></span>
              </div>
              <p className="text-xs text-dim">
                {Object.entries(r.rotations).map(([k, v]) => `${k} ${fmt(v)}p`).join(" · ")}
                {r.top.length > 0 && <> · mostly {r.top.map((t) => `${t.name.replace(/ Relic$/, " relic")} (${fmt(t.plat)}p)`).join(", ")}</>}
              </p>
              <p className="text-xs text-dim">Relics and arcanes are {r.pricedShare}% of what this mission drops{r.gaps > 0 ? ` · ${r.gaps} reward${r.gaps === 1 ? "" : "s"} not fully priced` : ""}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
