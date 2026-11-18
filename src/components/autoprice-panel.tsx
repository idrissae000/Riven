"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REPRICE_RULES, type RepriceRule } from "@/lib/wfm/reprice";

export interface AutoLogRow { id: string; item_name: string; old_price: number; new_price: number; cheapest: number | null; note: string | null; at: string }
export interface AutoSettingsRow { enabled: boolean; rule: RepriceRule; floor: number; max_drop_pct: number; follow_up: boolean; ceiling: number | null; last_run_at: string | null; note: string | null; status_seen: string | null; status_seen_at: string | null }

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Opt-in: the site lowers undercut sell orders for you, every 2 minutes while you are online in game, optionally above a minimum price you set. */
export function AutoPricePanel({ settings, log }: { settings: AutoSettingsRow | null; log: AutoLogRow[] }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [rule, setRule] = useState<RepriceRule>(settings?.rule ?? "undercut");
  const [floor, setFloor] = useState(settings && settings.floor > 1 ? String(settings.floor) : "");
  const [drop, setDrop] = useState(String(settings?.max_drop_pct ?? 15));
  const [follow, setFollow] = useState(settings?.follow_up ?? false);
  const [ceiling, setCeiling] = useState(settings?.ceiling ? String(settings.ceiling) : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(next: boolean) {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/autoprice", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: next, rule, floor: floor.trim() === "" ? null : Number(floor), max_drop_pct: Number(drop), follow_up: follow, ceiling: ceiling.trim() === "" ? null : Number(ceiling) }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(json.error ?? "Couldn’t save.");
    setEnabled(next); setMsg(next ? "Auto-repricing is on. It works while you show as online in game." : "Saved. Auto-repricing is off.");
    router.refresh();
  }

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="kicker">Undercut protection</h2>
        <span className={`text-xs ${enabled ? "text-ok" : "text-dim"}`}>{enabled ? "● On" : "○ Off"}</span>
      </div>
      <div className="rounded-sm border border-gold/40 p-3 text-sm text-ink">
        <p><b>Only works while you show as “online in game”.</b> Every 2 minutes it checks your status; if you’re invisible, online (not in game) or offline it does nothing, so it never touches your account or Warframe Market while you’re away. Set your status above.</p>
      </div>
      <p className="text-xs text-dim">While you’re in game, the site watches the cheapest online sellers and, when someone goes below you, lowers your sell order to <b className="text-ink">undercut or match them</b> (your choice), never below your minimum price (if you set one) and never by more than the cap in one step. It leaves hidden orders and buy orders alone, waits 10 minutes after changing an order, and ignores a market with fewer than 2 other online sellers. Every change is listed below.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label" htmlFor="ap-rule">Price to</label>
          <select id="ap-rule" className="input" value={rule} onChange={(e) => setRule(e.target.value as RepriceRule)}>{REPRICE_RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
        <div><label className="label" htmlFor="ap-floor">Never go below <span className="text-dim">(optional)</span></label>
          <input id="ap-floor" className="input" type="number" min={1} inputMode="numeric" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="No minimum" /></div>
        <div><label className="label" htmlFor="ap-drop">Biggest drop in one step (%)</label>
          <input id="ap-drop" className="input" type="number" min={1} max={50} inputMode="numeric" value={drop} onChange={(e) => setDrop(e.target.value)} /></div>
      </div>
      <label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" className="mt-1" checked={follow} onChange={(e) => setFollow(e.target.checked)} /><span>Also raise my price again when the cheapest seller raises theirs <span className="block text-xs text-dim">So you keep matching them both ways. It never goes above the highest price you set here.</span></span></label>
      {follow && <div className="max-w-xs"><label className="label" htmlFor="ap-ceil">Never go above (platinum)</label><input id="ap-ceil" className="input" type="number" min={1} inputMode="numeric" value={ceiling} onChange={(e) => setCeiling(e.target.value)} placeholder="Required" /></div>}
      <p className="text-xs text-dim">A minimum price is optional. If you set one it applies to <b className="text-ink">every</b> order, so keep it at or below the cheapest price you’d accept for your cheapest item. With none, the only limit is the cap on how far one step can move a price (and 1 platinum, the lowest Warframe Market allows).</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy} onClick={() => save(true)}>{enabled ? "Save changes" : "Turn on"}</button>
        {enabled && <button className="btn" disabled={busy} onClick={() => save(false)}>Turn off</button>}
      </div>
      {msg && <p role="status" className="text-sm text-ink">{msg}</p>}
      {settings?.status_seen && <p className="text-xs text-dim">Last check: you showed as <b className="text-ink">{settings.status_seen === "ingame" ? "online in game" : settings.status_seen}</b>{settings.status_seen_at ? ` · ${when(settings.status_seen_at)}` : ""}.</p>}
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
