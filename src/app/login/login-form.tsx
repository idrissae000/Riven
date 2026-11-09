"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

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
      if (error) setMsg({ kind: "err", text: error.message });
      else window.location.assign(next);
    } else {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) setMsg({ kind: "err", text: error.message });
      else if (data.session) window.location.assign(next);
      else setMsg({ kind: "ok", text: "Check your email to confirm your account, then sign in." });
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
    setMsg(error ? { kind: "err", text: error.message } : { kind: "ok", text: "Magic link sent — check your email." });
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
