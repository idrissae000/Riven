import Link from "next/link";
import { Nav } from "@/components/nav";
import { currentUserId } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const signedIn = !!(await currentUserId());
  return (
    <div className="md:pl-56">
      <Nav signedIn={signedIn} />
      {/* Mobile has no sidebar, so the optional sign-in lives in a slim top bar. */}
      <div className="flex items-center justify-between border-b border-line px-4 py-2 md:hidden">
        <span className="h-display text-lg"><span className="text-violet">◆</span> Riven <span className="text-teal">Buddy</span></span>
        {signedIn ? (
          <form action="/auth/signout" method="post"><button className="text-sm text-dim hover:text-teal" type="submit">Sign out</button></form>
        ) : (
          <Link href="/login" className="text-sm text-teal">Sign in</Link>
        )}
      </div>
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 md:pb-10 md:pt-10">{children}</main>
    </div>
  );
}
