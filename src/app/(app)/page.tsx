import Link from "next/link";
import { Plat } from "@/components/brand";
import { TrendBadge } from "@/components/trend";
import { currentUserId, listArcanePrices, listArcanes, listItemPrices, listTrends } from "@/lib/data";
import { priceView } from "@/lib/arcanes/price-view";
import { timeAgo } from "@/lib/format";
import { trendFromWeekly } from "@/lib/history";
import { valueInventory, type OwnedItem } from "@/lib/inventory/value";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { findFlips } from "@/lib/primes/flips";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: { absolute: "Warframe Economist — the all-in-one Warframe platinum tool" } };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const TOOLS = [
  { href: "/inventory/scan", title: "Scan your inventory", body: "Drop in screenshots of your Prime parts or arcanes — or a mission’s rewards — and it reads, prices and ranks them." },
  { href: "/inventory/listings", title: "Sell on Warframe Market", body: "List everything in bulk with auto-pricing, see who’s undercut you and reprice your orders without leaving the site." },
  { href: "/rivens/new", title: "Check a riven", body: "A grade for every roll and what comparable rivens are really listed for. No account needed." },
  { href: "/arcanes", title: "Arcane prices", body: "Live prices from online sellers, 90-day charts, and which Vosfor packs are worth opening." },
  { href: "/primes", title: "Prime parts & relics", body: "The most valuable parts, the best relics to run, and sets that sell for more than their parts." },
  { href: "/baro", title: "Baro Ki’Teer picks", body: "What Baro is selling, what it costs, and which items have historically rebounded after his visits — to hold for a week or for a month." },
  { href: "/varzia", title: "Varzia — Prime Resurgence", body: "Her Prime sets, what they cost in Regal Aya, what they sell for, and how their prices moved since her rotation began." },
  { href: "/live", title: "Live world state", body: "Fissures split into normal, Steel Path and Railjack, plus cycles, invasions and what’s on." },
];

/** The home page: what the site does, today's best platinum moves from live data, and (signed in) a snapshot of your own stuff. */
export default async function HomePage() {
  const [uid, prices, arcanes, arcanePrices, trends] = await Promise.all([currentUserId(), listItemPrices(), listArcanes(), listArcanePrices(), listTrends()]);
  const itemPrice = new Map(prices.map((p) => [p.slug, p]));
  const arcanePrice = new Map(arcanePrices.map((p) => [p.slug, p]));

  const flips = findFlips(primeCatalogue.parts, (s) => { const p = itemPrice.get(s); return p ? { price: p.avg5, listings: p.listings } : undefined; }).filter((f) => !f.thin).slice(0, 3);
  const arcaneRows = arcanes.flatMap((a) => {
    const v = priceView(arcanePrice.get(a.slug), a.max_rank);
    return v?.price != null ? [{ slug: a.slug, name: a.name, price: v.price, trend: trendFromWeekly(trends.get(a.slug)) }] : [];
  });
  const topArcanes = [...arcaneRows].sort((a, b) => b.price - a.price).slice(0, 3);
  const risers = arcaneRows.filter((a) => a.trend?.dir === "up" && a.price >= 5).sort((a, b) => b.trend!.changePct - a.trend!.changePct).slice(0, 3);
  const parts = primeCatalogue.parts.filter((p) => p.kind === "part" && itemPrice.get(p.slug)?.avg5 != null && (itemPrice.get(p.slug)?.listings ?? 0) >= 3)
    .sort((a, b) => (itemPrice.get(b.slug)!.avg5 as number) - (itemPrice.get(a.slug)!.avg5 as number)).slice(0, 3);
  const updated = arcanePrices.map((p) => p.fetched_at).filter((x): x is string => !!x).sort().at(-1);

  // signed in: a snapshot of the user's own saved inventory
  let mine: { total: number; priced: number; count: number } | null = null;
  if (uid) {
    const sb = await createClient();
    const { data } = await sb.from("inventory_items").select("id,kind,slug,rank,qty");
    const owned = (data ?? []) as OwnedItem[];
    const partBy = new Map(primeCatalogue.parts.map((p) => [p.slug, p]));
    const arcaneBy = new Map(arcanes.map((a) => [a.slug, a]));
    const v = valueInventory(owned, (i) => {
      if (i.kind === "prime") { const part = partBy.get(i.slug); return part ? { name: part.name, price: itemPrice.get(i.slug)?.avg5 ?? null, ducats: part.ducats } : undefined; }
      const a = arcaneBy.get(i.slug), row = arcanePrice.get(i.slug);
      return a ? { name: a.name, price: i.rank > 0 ? row?.max_avg5 ?? null : priceView(row, a.max_rank)?.price ?? null, ducats: null } : undefined;
    });
    mine = { total: v.total, priced: v.priced, count: v.count };
  }

  return (
    <div className="space-y-10">
      <section className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <p className="kicker">Warframe platinum toolkit</p>
          <h1 className="h-display text-[2.4rem] leading-[1.02] sm:text-5xl">Make more <span className="text-gold">platinum</span> from everything you own.</h1>
          <p className="max-w-xl text-[1.05rem] leading-relaxed text-dim">
            Real prices from players who are online right now. Scan your inventory, see what’s worth selling, and list it on Warframe Market in a couple of clicks.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/inventory/scan" className="btn-primary">Scan my inventory</Link>
            <Link href="/rivens/new" className="btn">Check a riven</Link>
            <Link href="/arcanes" className="btn">Browse arcanes</Link>
          </div>
          {updated && <p className="text-xs text-dim">Prices updated {timeAgo(updated)} · only online and in-game sellers count</p>}
        </div>

        <div className="card-glow space-y-3">
          {mine ? (
            <>
              <p className="kicker">Your saved inventory</p>
              <p className="h-display flex items-center gap-2 text-4xl text-plat">{mine.priced ? <>≈ {fmt(mine.total)} <Plat size={26} /></> : <span className="text-dim">—</span>}</p>
              <p className="text-sm text-dim">{mine.count === 0 ? "Nothing saved yet — scan or add your Prime parts and arcanes." : `${mine.priced} of ${mine.count} items priced.`}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href="/inventory" className="btn">Open inventory</Link>
                <Link href="/inventory/listings" className="btn">My listings</Link>
              </div>
            </>
          ) : (
            <>
              <p className="kicker">Optional account</p>
              <p className="text-sm leading-relaxed text-dim">Check rivens, browse arcane and Prime prices and read the live world state without signing up. Make an account to save your inventory and rivens, scan screenshots into them, and list and manage your Warframe Market orders from here.</p>
              <Link href="/login" className="btn-primary">Sign in</Link>
            </>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="kicker">Today’s best moves</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MoveCard title="Set flips" href="/primes/flips" empty="No profitable flips right now.">
            {flips.map((f) => (
              <li key={f.setSlug} className="flex items-baseline justify-between gap-2"><Link href={`/primes/${f.setSlug}`} className="min-w-0 truncate hover:text-gold">{f.name.replace(/ Set$/, "")}</Link><span className="shrink-0 font-mono text-ok">+{fmt(f.profit)}p</span></li>
            ))}
          </MoveCard>
          <MoveCard title="Top arcanes" href="/arcanes" empty="Prices are still loading.">
            {topArcanes.map((a) => (
              <li key={a.slug} className="flex items-baseline justify-between gap-2"><Link href={`/arcanes/${a.slug}`} className="min-w-0 truncate hover:text-gold">{a.name}</Link><span className="shrink-0 font-mono text-plat">{fmt(a.price)}p</span></li>
            ))}
          </MoveCard>
          <MoveCard title="Rising fastest" href="/arcanes" empty="Trends fill in as price history is collected.">
            {risers.map((a) => (
              <li key={a.slug} className="flex items-baseline justify-between gap-2"><Link href={`/arcanes/${a.slug}`} className="min-w-0 truncate hover:text-gold">{a.name}</Link><TrendBadge trend={a.trend} compact /></li>
            ))}
          </MoveCard>
          <MoveCard title="Priciest parts" href="/primes" empty="Prices are still loading.">
            {parts.map((p) => (
              <li key={p.slug} className="flex items-baseline justify-between gap-2"><Link href={`/primes/${p.slug}`} className="min-w-0 truncate hover:text-gold">{p.name}</Link><span className="shrink-0 font-mono text-plat">{fmt(itemPrice.get(p.slug)!.avg5 as number)}p</span></li>
            ))}
          </MoveCard>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="kicker">Everything in one place</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} className="tile block h-full">
              <h3 className="font-display text-base font-bold uppercase tracking-[0.08em] text-gold">{t.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-dim">{t.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function MoveCard({ title, href, empty, children }: { title: string; href: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="card space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-bold uppercase tracking-[0.08em]">{title}</h3>
        <Link href={href} className="shrink-0 whitespace-nowrap text-xs text-dim hover:text-gold">all →</Link>
      </div>
      {children.length === 0 ? <p className="text-sm text-dim">{empty}</p> : <ul className="space-y-1.5 text-sm">{children}</ul>}
    </div>
  );
}
