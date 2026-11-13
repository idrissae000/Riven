import { Plat } from "@/components/brand";
import { DUCAT_RATIO, ducatVerdict } from "@/lib/primes/ducats";

export interface DucatRow { name: string; qty: number; /** platinum price of one, null if unpriced */ unit: number | null; /** ducats one is worth */ ducats: number | null }
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** The Prime parts you own that are worth more as ducats (at Baro) than as platinum on the market, best ducats-per-platinum first. */
export function DucatList({ rows }: { rows: DucatRow[] }) {
  const items = rows
    .filter((r) => ducatVerdict(r.unit, r.ducats) === "ducat")
    .map((r) => ({ ...r, totalDucats: (r.ducats as number) * r.qty, totalPlat: Math.round((r.unit as number) * r.qty * 10) / 10, perPlat: (r.ducats as number) / (r.unit as number) }))
    .sort((a, b) => b.perPlat - a.perPlat || b.totalDucats - a.totalDucats);
  const ducats = items.reduce((s, r) => s + r.totalDucats, 0);
  const plat = Math.round(items.reduce((s, r) => s + r.totalPlat, 0) * 10) / 10;
  const parts = items.reduce((s, r) => s + r.qty, 0);

  return (
    <section className="card space-y-3">
      <h2 className="kicker">Put these in as ducats</h2>
      {items.length === 0 ? (
        <p className="text-sm text-dim">None of your parts are worth more as ducats right now. A part counts when it gives {DUCAT_RATIO}+ ducats for every platinum it sells for.</p>
      ) : (
        <>
          <p className="text-sm text-ink"><b>{parts} part{parts === 1 ? "" : "s"}</b> are worth more to Baro: together <b className="text-violet">{ducats} ducats</b>, but only <b className="text-plat">≈ {fmt(plat)}p</b> if you sold them for platinum.</p>
          <ul className="divide-y divide-line">
            {items.map((r) => (
              <li key={r.name} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-ink">{r.qty > 1 && `${r.qty}× `}{r.name}</p>
                  <p className="text-xs text-dim">{fmt(Math.round(r.perPlat * 10) / 10)} ducats per plat · sells for {fmt(r.unit as number)}p each</p>
                </div>
                <p className="text-sm text-dim"><span className="h-display normal-case text-violet">{r.totalDucats}</span> ducats <span className="text-xs">(≈ {fmt(r.totalPlat)} <Plat size={10} />)</span></p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-dim">A part is listed when it’s worth {DUCAT_RATIO}+ ducats per platinum of its market price (the average of the 5 cheapest online listings). Parts without a price aren’t judged.</p>
        </>
      )}
    </section>
  );
}
