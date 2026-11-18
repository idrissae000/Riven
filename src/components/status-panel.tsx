"use client";

import { useCallback, useEffect, useState } from "react";
import { useWfmStatus } from "@/components/wfm-connect";

type St = "invisible" | "online" | "ingame";
const OPTIONS: { value: St; label: string; help: string }[] = [
  { value: "ingame", label: "Online in game", help: "Shown as in game. Buyers message you, and auto-pricing works." },
  { value: "online", label: "Online", help: "Shown online, not in game." },
  { value: "invisible", label: "Invisible", help: "Hidden: your orders don’t count as online sellers." },
];
const DURATIONS = [{ v: 3600, l: "1 hour" }, { v: 4 * 3600, l: "4 hours" }, { v: 8 * 3600, l: "8 hours" }, { v: 0, l: "Until I change it" }];
const label = (s: string | null) => (s === "ingame" ? "Online in game" : s === "online" ? "Online" : s === "invisible" ? "Invisible" : s === "offline" ? "Offline" : "Unknown");

/** Your Warframe Market status: invisible, online or online in game. */
export function StatusPanel() {
  const { status } = useWfmStatus();
  const [now, setNow] = useState<string | null | undefined>(undefined);
  const [dur, setDur] = useState(4 * 3600);
  const [busy, setBusy] = useState<St | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchNow = useCallback(() => fetch("/api/market/status", { cache: "no-store" }).then(async (r) => { const j = await r.json().catch(() => ({})); return r.ok ? ((j.status as string | null) ?? null) : null; }).catch(() => null), []);
  const read = useCallback(() => { void fetchNow().then(setNow); }, [fetchNow]);
  useEffect(() => {
    if (!status?.connected) return;
    let alive = true;
    void fetchNow().then((s) => { if (alive) setNow(s); });
    return () => { alive = false; };
  }, [status, fetchNow]);
  if (!status?.connected) return null;

  async function set(s: St) {
    setBusy(s); setMsg(null);
    try {
      const res = await fetch("/api/market/status", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s, duration: dur }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { setNow(s); setMsg({ ok: true, text: `You’re now ${label(s).toLowerCase()}${dur ? ` for ${DURATIONS.find((d) => d.v === dur)?.l ?? ""}` : ""}.` }); }
      else setMsg({ ok: false, text: j.error ?? "Couldn’t change your status." });
    } catch { setMsg({ ok: false, text: "Couldn’t reach the server." }); }
    setBusy(null);
  }

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="kicker">Your Warframe Market status</h2>
        <span className="text-xs text-dim">Now: <b className="text-ink">{now === undefined ? "checking…" : label(now)}</b> <button className="ml-1 underline hover:text-gold" onClick={read}>refresh</button></span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <button key={o.value} className={`tile text-left ${now === o.value ? "border-gold" : ""}`} disabled={busy !== null} aria-pressed={now === o.value} onClick={() => set(o.value)}>
            <span className={`block font-display text-sm font-bold uppercase tracking-[0.08em] ${now === o.value ? "text-gold" : "text-ink"}`}>{busy === o.value ? "Setting…" : o.label}</span>
            <span className="mt-1 block text-xs text-dim">{o.help}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-dim">
        <label htmlFor="st-dur">Keep it for</label>
        <select id="st-dur" className="input !min-h-8 w-auto !py-1 text-xs" value={dur} onChange={(e) => setDur(Number(e.target.value))}>{DURATIONS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}</select>
        <span>This is the status buyers see next to your orders.</span>
      </div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
    </section>
  );
}
