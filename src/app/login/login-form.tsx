"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { friendlyAuthError, isExistingAccount } from "@/lib/auth-errors";

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const sb = createBrowserSupabase();
    if (mode === "signin") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) setMsg({ kind: "err", text: friendlyAuthError(error) });
      else window.location.assign(next);
    } else {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) setMsg({ kind: "err", text: friendlyAuthError(error) });
      else if (data.session) window.location.assign(next);
      else if (isExistingAccount(data.user)) {
        // Supabase "succeeds" but sends nothing for an address that already has an account.
        setMode("signin");
        setMsg({ kind: "err", text: "An account with this email already exists, so no new email was sent. Sign in instead — or tap “Email me a magic link”." });
      } else setMsg({ kind: "ok", text: `We sent a confirmation link to ${email}. It can take a minute — check spam too, then sign in.` });
    }
    setBusy(false);
  }

  async function magicLink() {
    if (!email) return setMsg({ kind: "err", text: "Enter your email first." });
    setBusy(true);
    const sb = createBrowserSupabase();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setMsg(error ? { kind: "err", text: friendlyAuthError(error) } : { kind: "ok", text: "Magic link sent — check your email (and spam)." });
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" className="input" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {msg && <p className={`text-sm ${msg.kind === "err" ? "text-danger" : "text-ok"}`}>{msg.text}</p>}
      <button className="btn-primary w-full" disabled={busy}>{mode === "signin" ? "Sign in" : "Create account"}</button>
      <button type="button" className="btn w-full" disabled={busy} onClick={magicLink}>Email me a magic link</button>
      <button type="button" className="w-full text-sm text-dim hover:text-teal" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </form>
  );
}
