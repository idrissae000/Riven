import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 flex justify-center"><Wordmark /></div>
      <p className="kicker mb-2">Optional sign-in</p>
      <h1 className="h-display mb-2 text-3xl">Save your rivens</h1>
      <p className="mb-5 text-sm leading-relaxed text-dim">You don’t need an account to check rivens or browse arcanes. Sign in to keep a vault of your rivens, list them on Warframe Market and track them over time.</p>
      <p className="mb-4 text-sm"><Link href="/rivens" className="text-teal hover:underline">Continue without an account →</Link></p>
      <div className="card-glow">
        {error && <p className="mb-3 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
        <LoginForm next={next && next.startsWith("/") ? next : "/rivens"} />
      </div>
    </main>
  );
}
