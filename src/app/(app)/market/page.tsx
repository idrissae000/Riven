import Link from "next/link";
import { getReferenceData, listRivens } from "@/lib/data";
import { MarketAccount } from "./market-account";

export const metadata = { title: "Market" };

export default async function MarketPage() {
  const [rivens, ref] = await Promise.all([listRivens(), getReferenceData()]);
  const name = new Map(ref.weapons.map((w) => [w.slug, w.name]));
  const listed = rivens.filter((r) => r.wfm_auction_id);

  return (
    <div className="space-y-5">
      <h1 className="h-display text-3xl">Market</h1>
      <section className="card-glow space-y-3">
        <h2 className="h-display text-xl text-teal">Warframe Market account</h2>
        <MarketAccount />
      </section>

      <section className="card space-y-3">
        <h2 className="h-display text-xl text-violet">Listed from Riven Buddy</h2>
        {listed.length === 0 ? (
          <p className="text-sm text-dim">Nothing listed yet. Open a riven and tap <strong>List on WFM</strong>.</p>
        ) : (
          <ul className="divide-y divide-line">
            {listed.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/rivens/${r.id}`} className="min-w-0 truncate hover:text-teal">
                  {name.get(r.weapon_slug) ?? r.weapon_slug} <span className="text-violet">{r.riven_name}</span>
                </Link>
                <span className="flex items-center gap-3 text-sm">
                  {r.wfm_price != null && <span className="font-mono text-orange">{r.wfm_price}p</span>}
                  <a className="text-teal hover:underline" href={`https://warframe.market/auction/${r.wfm_auction_id}`} target="_blank" rel="noopener noreferrer">View ↗</a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
