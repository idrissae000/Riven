"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { IconArcane, IconBaro, IconInsights, IconInventory, IconListings, IconLive, IconMore, IconPortfolio, IconPrime, IconRiven, IconSell, IconVarzia, Wordmark } from "@/components/brand";

interface Tab { href: string; label: string; hint: string; Icon: (p: { size?: number }) => React.ReactNode }

/** The three things the site is for come first and look bigger; everything else is grouped by what it's for. */
const GROUPS: { label: string; core?: boolean; tabs: Tab[] }[] = [
  {
    label: "Start here", core: true,
    tabs: [
      { href: "/rivens", label: "Rivens", hint: "Grade a riven, see its price", Icon: IconRiven },
      { href: "/sell", label: "Sell in bulk", hint: "Scan, price and list everything", Icon: IconSell },
      { href: "/inventory/listings", label: "My listings", hint: "Reprice, undercut protection", Icon: IconListings },
    ],
  },
  {
    label: "Your stuff",
    tabs: [
      { href: "/inventory", label: "Inventory", hint: "Parts, arcanes, rivens, sales", Icon: IconInventory },
      { href: "/portfolio", label: "My portfolio", hint: "Value, profit, watchlist", Icon: IconPortfolio },
    ],
  },
  {
    label: "Markets",
    tabs: [
      { href: "/arcanes", label: "Arcanes", hint: "Prices and Vosfor", Icon: IconArcane },
      { href: "/primes", label: "Primes", hint: "Parts, relics, flips, deals", Icon: IconPrime },
      { href: "/baro", label: "Baro", hint: "Ducat picks", Icon: IconBaro },
      { href: "/varzia", label: "Varzia", hint: "Relic packs per Aya", Icon: IconVarzia },
    ],
  },
  {
    label: "Tools",
    tabs: [
      { href: "/insights", label: "Insights", hint: "Market index, accuracy", Icon: IconInsights },
      { href: "/live", label: "Live", hint: "Fissures and cycles", Icon: IconLive },
    ],
  },
];
const ALL = GROUPS.flatMap((g) => g.tabs);
/** The four tabs on the phone's bottom bar; the rest are under "More". */
const BAR = ["/rivens", "/sell", "/inventory/listings", "/inventory"];

export function Nav({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  // the More sheet is open only on the page it was opened from, so navigating closes it
  const [moreAt, setMoreAt] = useState<string | null>(null);
  const more = moreAt === path;
  // the most specific tab wins, so "My listings" doesn't also light up "Inventory"
  const current = ALL.filter((t) => path === t.href || path.startsWith(t.href + "/")).sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
  const on = (href: string) => current === href;
  const bar = BAR.map((h) => ALL.find((t) => t.href === h) as Tab);
  const moreActive = !!current && !BAR.includes(current);

  return (
    <>
      {/* Desktop: left rail */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col overflow-y-auto border-r border-line bg-void/85 px-4 py-6 backdrop-blur md:flex">
        <div className="mb-7 px-2"><Wordmark /></div>
        <nav className="flex flex-col gap-5" aria-label="Main">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <p className={`mb-1.5 px-2 font-display text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${g.core ? "text-gold" : "text-dim"}`}>{g.label}</p>
              <div className="flex flex-col gap-1">
                {g.tabs.map(({ href, label, hint, Icon }) => (
                  <Link
                    key={href} href={href} aria-current={on(href) ? "page" : undefined}
                    className={`relative flex items-center gap-3 px-3 transition ${g.core ? "min-h-14 border border-line" : "min-h-10"} ${on(href) ? "bg-gradient-to-r from-gold/15 to-transparent text-gold" : g.core ? "text-ink hover:border-gold/50 hover:bg-panel-2" : "text-dim hover:bg-panel-2 hover:text-ink"}`}
                  >
                    {on(href) && <span className="absolute inset-y-1 left-0 w-[3px] bg-gold shadow-[0_0_12px_var(--color-gold)]" />}
                    <Icon size={g.core ? 22 : 18} />
                    <span className="min-w-0">
                      <span className={`block font-display font-semibold uppercase tracking-[0.1em] ${g.core ? "text-[0.9rem]" : "text-[0.78rem]"}`}>{label}</span>
                      {g.core && <span className={`block truncate text-[0.7rem] normal-case tracking-normal ${on(href) ? "text-gold/70" : "text-dim"}`}>{hint}</span>}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-auto space-y-2 border-t border-line pt-4">
          {signedIn ? (
            <form action="/auth/signout" method="post"><button className="btn w-full" type="submit">Sign out</button></form>
          ) : (
            <>
              <p className="px-1 text-xs leading-relaxed text-dim">Everything works without an account. Sign in to save and track rivens.</p>
              <Link href="/login" className="btn w-full">Sign in</Link>
            </>
          )}
        </div>
      </aside>

      {/* Mobile: the core tabs on the bar, everything else under More */}
      {more && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMoreAt(null)}>
          <div className="absolute inset-x-0 bottom-16 max-h-[70vh] space-y-4 overflow-y-auto border-t border-line-2 bg-void/98 px-4 pb-6 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] backdrop-blur" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="More pages">
            {GROUPS.map((g) => {
              const tabs = g.tabs.filter((t) => !BAR.includes(t.href));
              return tabs.length === 0 ? null : (
                <div key={g.label}>
                  <p className="mb-1.5 font-display text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-dim">{g.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {tabs.map(({ href, label, hint, Icon }) => (
                      <Link key={href} href={href} aria-current={on(href) ? "page" : undefined} className={`flex items-center gap-3 border px-3 py-2.5 ${on(href) ? "border-gold/60 text-gold" : "border-line text-ink"}`}>
                        <Icon size={20} />
                        <span className="min-w-0"><span className="block font-display text-sm font-semibold uppercase tracking-[0.06em]">{label}</span><span className="block truncate text-[0.7rem] text-dim">{hint}</span></span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <nav aria-label="Main" data-mobile-nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line-2 bg-void/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {bar.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={on(href) ? "page" : undefined} className={`relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 font-display text-[0.68rem] font-semibold uppercase tracking-[0.03em] transition ${on(href) ? "text-gold" : "text-dim"}`}>
            {on(href) && <span className="absolute inset-x-5 top-0 h-[2px] bg-gold shadow-[0_0_10px_var(--color-gold)]" />}
            <Icon size={22} />
            {label}
          </Link>
        ))}
        <button type="button" aria-expanded={more} onClick={() => setMoreAt(more ? null : path)} className={`relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 font-display text-[0.68rem] font-semibold uppercase tracking-[0.03em] transition ${more || moreActive ? "text-gold" : "text-dim"}`}>
          {moreActive && <span className="absolute inset-x-5 top-0 h-[2px] bg-gold shadow-[0_0_10px_var(--color-gold)]" />}
          <IconMore size={22} />
          More
        </button>
      </nav>
    </>
  );
}
