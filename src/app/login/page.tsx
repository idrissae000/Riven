import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="h-display mb-1 text-center text-5xl">
        <span className="text-violet">◆</span> Riven <span className="text-teal">Buddy</span>
      </h1>
      <p className="mb-8 text-center text-dim">Optional — sign in to save and track your rivens.</p>
      <p className="mb-4 text-center text-sm"><a href="/rivens" className="text-teal hover:underline">Continue without an account →</a></p>
      <div className="card-glow">
        {error && <p className="mb-3 rounded-lg bg-danger/10 p-2 text-sm text-danger">{error}</p>}
        <LoginForm next={next && next.startsWith("/") ? next : "/rivens"} />
      </div>
    </main>
  );
}
