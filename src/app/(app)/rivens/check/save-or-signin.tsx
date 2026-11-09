"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RivenInput } from "@/lib/riven-schema";

/** Signed in: one tap saves this checked riven. Guest: a gentle, optional nudge to sign in. */
export function SaveOrSignIn({ riven, signedIn, nextPath }: { riven: RivenInput; signedIn: boolean; nextPath: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn)
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 border-violet/40">
        <p className="min-w-0 flex-1 text-sm text-dim">Want to keep this riven and track it? Sign in (optional) to save it.</p>
        <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="btn border-violet/50 text-violet">Sign in to save</Link>
      </div>
    );

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/rivens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(riven) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Could not save.");
    router.push(`/rivens/${json.id}`);
    router.refresh();
  }

  return (
    <div className="card space-y-2">
      <button className="btn-primary w-full" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save this riven"}</button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
