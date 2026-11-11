import Link from "next/link";
import { Nav } from "@/components/nav";
import { Wordmark } from "@/components/brand";
import { currentUserId } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const signedIn = !!(await currentUserId());
  return (
    <div className="md:pl-60">
      <Nav signedIn={signedIn} />
      {/* Mobile has no sidebar, so the optional sign-in lives in a slim top bar. */}
      <div className="flex items-center justify-between border-b border-line bg-void/70 px-4 py-2.5 md:hidden">
        <Wordmark compact />
        {signedIn ? (
          <form action="/auth/signout" method="post"><button className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-dim hover:text-gold" type="submit">Sign out</button></form>
        ) : (
          <Link href="/login" className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-gold">Sign in</Link>
        )}
      </div>
      <main className="mx-auto w-full max-w-4xl px-4 pb-28 pt-6 md:pb-10 md:pt-10">{children}</main>
    </div>
  );
}
