"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/rivens", label: "Rivens", icon: "◈" },
  { href: "/arcanes", label: "Arcanes", icon: "✦" },
  { href: "/market", label: "Market", icon: "⬡" },
];

export function Nav() {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <>
      {/* Desktop: left rail */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-line bg-panel/80 p-4 backdrop-blur md:flex">
        <Link href="/rivens" className="h-display mb-8 flex items-center gap-2 text-2xl text-ink">
          <span className="text-violet">◆</span> Riven <span className="text-teal">Buddy</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${
                active(t.href) ? "bg-teal/10 text-teal" : "text-dim hover:bg-panel-2 hover:text-ink"
              }`}
            >
              <span className="text-lg">{t.icon}</span>
              {t.label}
            </Link>
          ))}
        </nav>
        <form action="/auth/signout" method="post" className="mt-auto">
          <button className="btn w-full" type="submit">Sign out</button>
        </form>
      </aside>

      {/* Mobile: bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active(t.href) ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition ${
              active(t.href) ? "text-teal" : "text-dim"
            }`}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
