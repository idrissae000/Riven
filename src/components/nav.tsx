"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconArcane, IconInventory, IconLive, IconPrime, IconRiven, Wordmark } from "@/components/brand";

const TABS = [
  { href: "/inventory", label: "Inventory", Icon: IconInventory },
  { href: "/rivens", label: "Rivens", Icon: IconRiven },
  { href: "/arcanes", label: "Arcanes", Icon: IconArcane },
  { href: "/primes", label: "Primes", Icon: IconPrime },
  { href: "/live", label: "Live", Icon: IconLive },
];

export function Nav({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <>
      {/* Desktop: left rail */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-void/85 px-4 py-6 backdrop-blur md:flex">
        <div className="mb-9 px-2"><Wordmark /></div>
        <p className="kicker mb-3 px-2 !text-xs !text-dim before:!bg-line-2">Navigate</p>
        <nav className="flex flex-col gap-1">
          {TABS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={`relative flex min-h-11 items-center gap-3 px-3 font-display text-[0.82rem] font-semibold uppercase tracking-[0.1em] transition ${
                active(href) ? "bg-gradient-to-r from-gold/15 to-transparent text-gold" : "text-dim hover:bg-panel-2 hover:text-ink"
              }`}
            >
              {active(href) && <span className="absolute inset-y-1 left-0 w-[3px] bg-gold shadow-[0_0_12px_var(--color-gold)]" />}
              <Icon size={20} />
              {label}
            </Link>
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

      {/* Mobile: bottom tab bar */}
      <nav style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }} className="fixed inset-x-0 bottom-0 z-20 grid border-t border-line-2 bg-void/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {TABS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={active(href) ? "page" : undefined}
            className={`relative flex min-h-16 flex-col items-center justify-center gap-1 font-display text-xs font-semibold uppercase tracking-[0.1em] transition ${active(href) ? "text-gold" : "text-dim"}`}
          >
            {active(href) && <span className="absolute inset-x-5 top-0 h-[2px] bg-gold shadow-[0_0_10px_var(--color-gold)]" />}
            <Icon size={22} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
