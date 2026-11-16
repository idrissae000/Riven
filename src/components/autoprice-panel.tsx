"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REPRICE_RULES, type RepriceRule } from "@/lib/wfm/reprice";

export interface AutoLogRow { id: string; item_name: string; old_price: number; new_price: number; cheapest: number | null; note: string | null; at: string }
export interface AutoSettingsRow { enabled: boolean; rule: RepriceRule; floor: number; max_drop_pct: number; last_run_at: string | null; note: string | null }

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Opt-in: the site lowers undercut sell orders for you, every 10 minutes, within a floor you set. */
export function AutoPricePanel({ settings, log }: { settings: AutoSettingsRow | null; log: AutoLogRow[] }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [rule, setRule] = useState<RepriceRule>(settings?.rule ?? "undercut");
  const [floor, setFloor] = useState(settings?.floor ? String(settings.floor) : "");
  const [drop, setDrop] = useState(String(settings?.max_drop_pct ?? 15));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(next: boolean) {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/autoprice", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: next, rule, floor: Number(floor), max_drop_pct: Number(drop) }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(json.error ?? "Couldn’t save.");
    setEnabled(next); setMsg(next ? "Auto-repricing is on. It checks every 10 minutes." : "Saved. Auto-repricing is off.");
    router.refresh();
  }

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="kicker">Undercut protection</h2>
        <span className={`text-xs ${enabled ? "text-ok" : "text-dim"}`}>{enabled ? "● On" : "○ Off"}</span>
      </div>
      <p className="text-xs text-dim">When another online seller goes below you, the site lowers your sell order for you, every 10 minutes, even when you’re not on the site. It only ever <b className="text-ink">lowers</b> a price you’ve been undercut on — never raises, never goes under your floor, never drops more than the cap in one step, leaves hidden orders and buy orders alone, and waits an hour after any change to an order. It ignores a market with fewer than 2 other online sellers. Every change is listed below.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label" htmlFor="ap-rule">Price to</label>
          <select id="ap-rule" className="input" value={rule} onChange={(e) => setRule(e.target.value as RepriceRule)}>{REPRICE_RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
        <div><label className="label" htmlFor="ap-floor">Never go below (platinum)</label>
          <input id="ap-floor" className="input" type="number" min={1} inputMode="numeric" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="Required" /></div>
        <div><label className="label" htmlFor="ap-drop">Biggest drop in one step (%)</label>
          <input id="ap-drop" className="input" type="number" min={1} max={50} inputMode="numeric" value={drop} onChange={(e) => setDrop(e.target.value)} /></div>
      </div>
      <p className="text-xs text-dim">The floor applies to <b className="text-ink">every</b> order. Set it at or below the cheapest price you’d accept for your cheapest item; for items you’d price lower than that, reprice by hand.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy} onClick={() => save(true)}>{enabled ? "Save changes" : "Turn on"}</button>
        {enabled && <button className="btn" disabled={busy} onClick={() => save(false)}>Turn off</button>}
      </div>
      {msg && <p role="status" className="text-sm text-ink">{msg}</p>}
      {settings?.note && <p className="text-sm text-orange">{settings.note}</p>}
      {log.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-dim">Recent automatic changes</p>
          <ul className="divide-y divide-line text-sm">
            {log.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-1.5">
                <span className="text-ink">{l.item_name}</span>
                <span className="text-xs text-dim">{l.old_price}p → <b className="text-plat">{l.new_price}p</b>{l.cheapest != null ? ` (cheapest was ${l.cheapest}p)` : ""}{l.note ? ` · ${l.note}` : ""} · {when(l.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
