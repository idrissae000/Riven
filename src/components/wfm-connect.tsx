"use client";

import { useCallback, useEffect, useState } from "react";

export interface WfmStatus { configured: boolean; connected: boolean; name?: string | null; expiresAt?: string | null }

export function useWfmStatus() {
  const [status, setStatus] = useState<WfmStatus | null>(null);
  const refresh = useCallback(async () => {
    const res = await fetch("/api/wfm/status", { cache: "no-store" });
    setStatus(res.ok ? await res.json() : { configured: false, connected: false });
  }, []);
  useEffect(() => {
    let alive = true;
    fetch("/api/wfm/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { configured: false, connected: false }))
      .catch(() => ({ configured: false, connected: false }))
      .then((s) => alive && setStatus(s));
    return () => { alive = false; };
  }, []);
  return { status, refresh };
}

/**
 * Sign in to Warframe Market. The password goes to OUR server once, is exchanged for a
 * session token, and is discarded — only the encrypted token is stored. The field is
 * cleared as soon as the request finishes.
 */
export function WfmConnect({ status, onChange }: { status: WfmStatus | null; onChange: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!status) return <div className="h-12 animate-pulse bg-panel-2" />;
  if (!status.configured)
    return <p className="rounded-lg border border-orange/40 bg-orange/10 p-3 text-sm text-orange">Warframe Market sign-in needs <code>WFM_TOKEN_ENCRYPTION_KEY</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> set on the server (see .env.example).</p>;

  if (status.connected)
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          <span className="mr-2 inline-block size-2 rounded-full bg-ok" />
          Connected as <strong className="text-teal">{status.name ?? "your account"}</strong>
          {status.expiresAt && <span className="block text-xs text-dim">Session valid until {new Date(status.expiresAt).toLocaleDateString()}</span>}
        </div>
        <button className="btn min-h-9 px-3 text-xs" onClick={async () => { await fetch("/api/wfm/signout", { method: "POST" }); onChange(); }}>Disconnect</button>
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/wfm/signin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const json = await res.json().catch(() => ({}));
    setPassword("");
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Sign-in failed.");
    onChange();
  }

  return (
    <form onSubmit={submit} className="space-y-3" autoComplete="off">
      <p className="text-xs text-dim">Sign in with your Warframe Market account. Your password is sent once to exchange for a session token and is never stored — only the encrypted token is kept, and you can disconnect any time.</p>
      <input className="input" type="email" required placeholder="Warframe Market email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      <input className="input" type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Connecting…" : "Connect Warframe Market"}</button>
    </form>
  );
}
