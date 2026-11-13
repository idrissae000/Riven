"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plat } from "@/components/brand";
import { summarizeSales, type SaleRow } from "@/lib/sales/detect";

export interface SaleItem extends SaleRow { source: string }
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const ONE_DAY = 86_400_000;

/** Platinum earned: confirmed sales (typed in, or detected from your Warframe Market orders and confirmed here), by week, with the log underneath. */
export function SalesTracker({ sales, itemNames, now, connected }: { sales: SaleItem[]; itemNames: string[]; now: number; connected: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sum = useMemo(() => summarizeSales(sales, now), [sales, now]);
  const pending = sales.filter((s) => s.status === "pending");
  const log = sales.filter((s) => s.status === "confirmed").sort((a, b) => b.sold_at.localeCompare(a.sold_at));
  const maxWeek = Math.max(1, ...sum.weekly.map((w) => w.plat));

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true); setMsg(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(json.error ?? "Something went wrong."); return false; }
    router.refresh();
    return json;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const q = Number(qty), p = Number(price);
    if (!name.trim() || !Number.isInteger(q) || q < 1 || !Number.isInteger(p) || p < 1) return setMsg("Enter what you sold, how many, and the price each (whole platinum).");
    const ok = await call("/api/sales", "POST", { item_name: name.trim(), qty: q, price_each: p, ...(when ? { sold_at: new Date(when + "T12:00:00").toISOString() } : {}) });
    if (ok) { setName(""); setQty("1"); setPrice(""); setWhen(""); }
  }

  async function check() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/sales/sync", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(json.skipped === "not-connected" ? "Connect your Warframe Market account first (Inventory → My listings)." : json.baseline ? "Saved a starting point — from now on, orders that disappear or shrink show up here to confirm." : json.pending ? `${json.pending} possible sale${json.pending === 1 ? "" : "s"} to review.` : "Nothing new — no orders have disappeared or shrunk since the last check.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Last 7 days" value={`${fmt(sum.week)}`} plat />
        <Tile label="Last 30 days" value={`${fmt(sum.month)}`} plat />
        <Tile label="All time" value={`${fmt(sum.all)}`} plat />
        <Tile label="Sales logged" value={String(sum.count)} />
      </section>

      <section className="card space-y-3">
        <h2 className="kicker">Platinum per week</h2>
        <div className="flex h-32 items-end gap-2" role="img" aria-label="Platinum earned per week, last 8 weeks">
          {sum.weekly.map((w) => (
            <div key={w.start} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs text-plat">{w.plat ? fmt(w.plat) : ""}</span>
              <div className="w-full bg-plat/70" style={{ height: `${w.plat ? Math.max(4, (w.plat / maxWeek) * 88) : 2}px`, opacity: w.plat ? 1 : 0.3 }} />
              <span className="text-[0.7rem] text-dim">{w.start.slice(5)}</span>
            </div>
          ))}
        </div>
        {sum.top.length > 0 && <p className="text-xs text-dim">Top earners: {sum.top.map((t) => `${t.name} (${fmt(t.plat)}p)`).join(" · ")}</p>}
      </section>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="kicker">Looks sold — confirm?</h2>
          <button className="btn min-h-9 px-3 text-xs" onClick={check} disabled={busy || !connected}>{busy ? "Checking…" : "Check my orders now"}</button>
        </div>
        <p className="text-xs text-dim">{connected ? "Each time you open My listings (or press the button), the site compares your Warframe Market sell orders with the last time. An order that disappeared or got smaller is listed here as a probable sale — it could also be one you removed or lowered, so you confirm it. It can only see orders it has looked at before, so a sale that happens and is gone between two looks is missed — add those by hand." : "Connect your Warframe Market account (Inventory → My listings) to have probable sales detected for you. You can always add sales by hand below."}</p>
        {pending.length === 0 ? <p className="text-sm text-dim">Nothing waiting for you.</p> : (
          <ul className="divide-y divide-line">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
                <p className="text-sm text-ink">{p.qty}× {p.item_name} <span className="text-dim">at</span> <span className="text-plat">{p.price_each}p</span> <span className="text-xs text-dim">· seen {day(p.sold_at)}</span></p>
                <div className="flex gap-2">
                  <button className="btn-primary min-h-9 px-3 text-xs" disabled={busy} onClick={() => call(`/api/sales/${p.id}`, "PATCH", { status: "confirmed" })}>Yes, sold</button>
                  <button className="btn min-h-9 px-3 text-xs" disabled={busy} onClick={() => call(`/api/sales/${p.id}`, "PATCH", { status: "dismissed" })}>No, I removed it</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={add} className="card space-y-3">
        <h2 className="kicker">Add a sale by hand</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_5rem_6rem_9rem]">
          <div><label className="label" htmlFor="s-name">What you sold</label><input id="s-name" className="input" list="s-items" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Primed Flow" autoComplete="off" /><datalist id="s-items">{itemNames.map((n) => <option key={n} value={n} />)}</datalist></div>
          <div><label className="label" htmlFor="s-qty">Qty</label><input id="s-qty" className="input" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div><label className="label" htmlFor="s-price">Price each</label><input id="s-price" className="input" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="plat" /></div>
          <div><label className="label" htmlFor="s-when">Date <span className="text-dim">(optional)</span></label><input id="s-when" className="input" type="date" max={new Date(now + ONE_DAY).toISOString().slice(0, 10)} value={when} onChange={(e) => setWhen(e.target.value)} /></div>
        </div>
        <button className="btn-primary" disabled={busy}>Add sale</button>
      </form>
      {msg && <p role="status" className="text-sm text-ink">{msg}</p>}

      <section className="card space-y-1">
        <h2 className="kicker">Sales log</h2>
        {log.length === 0 ? <p className="text-sm text-dim">No sales yet.</p> : (
          <ul className="divide-y divide-line">
            {log.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{s.qty > 1 && `${s.qty}× `}{s.item_name}</p>
                  <p className="text-xs text-dim">{day(s.sold_at)} · {s.source === "detected" ? "detected, confirmed" : "added by hand"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-display flex items-center gap-1 text-lg text-plat">{fmt(s.qty * s.price_each)} <Plat size={13} /></span>
                  <span className="text-xs text-dim">{s.qty > 1 ? `${s.price_each} each` : ""}</span>
                  <button className="text-xs text-dim hover:text-danger" disabled={busy} onClick={() => { if (confirm(`Remove this sale of ${s.item_name}?`)) void call(`/api/sales/${s.id}`, "DELETE"); }} aria-label={`Remove sale of ${s.item_name}`}>remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, plat = false }: { label: string; value: string; plat?: boolean }) {
  return <div className="card !p-3.5"><p className="text-xs text-dim">{label}</p><p className="h-display mt-0.5 flex items-center gap-1.5 text-3xl text-ink">{value}{plat && <Plat size={20} />}</p></div>;
}
