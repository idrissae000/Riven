"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plat } from "@/components/brand";
import { InventoryFilter } from "@/components/inventory-filter";
import { WfmConnect, useWfmStatus } from "@/components/wfm-connect";
import { browseRows, type InvSort } from "@/lib/inventory/browse";
import { REPRICE_RULES, repriceSellOrder, repricedValue, type RepriceRule } from "@/lib/wfm/reprice";
import type { Listing } from "@/lib/wfm/listings";
import type { MyAuction, MyOrder } from "@/app/api/market/orders/route";

interface Data { name: string | null; orders: MyOrder[]; auctions: MyAuction[] }
type Mkt = Listing[] | "loading" | "error";
const MIN_KEY = "riven-reprice-floor";
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const mkey = (o: MyOrder) => `${o.item.slug}:${o.rank}`;
const ago = (iso: string | null) => { if (!iso) return ""; const d = Math.max(0, Date.now() - Date.parse(iso)); const h = d / 3_600_000; return h < 1 ? "just now" : h < 48 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`; };

/** Everything the user has listed on Warframe Market — sell orders, buy orders and riven auctions — editable from here, with bulk repricing. */
export function ListingsManager() {
  const { status, refresh } = useWfmStatus();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mkt, setMkt] = useState<Record<string, Mkt>>({});
  const [price, setPrice] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [rule, setRule] = useState<RepriceRule>("undercut");
  const [floor, setFloor] = useState(() => { try { return localStorage.getItem(MIN_KEY) ?? ""; } catch { return ""; } });
  const [allowRaise, setAllowRaise] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<InvSort>("price");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [salesNote, setSalesNote] = useState(0);
  const [rowMsg, setRowMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const asked = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch("/api/market/orders", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!mounted.current) return;
      if (!res.ok) { setErr(json.error ?? "Couldn’t load your listings."); if (json.reauth) refresh(); }
      else {
        setData(json as Data); setPrice({}); setSel({});
        // note orders that disappeared or shrank since the last look (probable sales) — the Sales tab asks you to confirm them
        fetch("/api/sales/sync", { method: "POST" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (mounted.current && j?.pending > 0) setSalesNote(j.pending); }).catch(() => {});
      }
    } catch { if (mounted.current) setErr("Couldn’t reach the server."); }
    if (mounted.current) setLoading(false);
  }, [refresh]);
  useEffect(() => { if (status?.connected) void load(); else if (status) setLoading(false); }, [status, load]);

  const sells = useMemo(() => (data?.orders ?? []).filter((o) => o.type === "sell"), [data]);
  const buys = useMemo(() => (data?.orders ?? []).filter((o) => o.type === "buy"), [data]);
  const sellKeys = sells.map(mkey).join("|");

  // The 5 cheapest online listings for each distinct item+rank you're selling.
  useEffect(() => {
    const todo = [...new Map(sells.map((o) => [mkey(o), o])).values()].filter((o) => !asked.current.has(mkey(o)));
    if (!todo.length) return;
    todo.forEach((o) => asked.current.add(mkey(o)));
    const queue = [...todo];
    const worker = async () => {
      for (let o = queue.shift(); o && mounted.current; o = queue.shift()) {
        const key = mkey(o);
        setMkt((m) => ({ ...m, [key]: "loading" }));
        let r: Mkt = "error";
        try { const res = await fetch(`/api/market/listings?kind=item&slug=${encodeURIComponent(o.item.slug)}&rank=${o.rank}`); if (res.ok) r = ((await res.json()) as { listings: Listing[] }).listings; } catch { /* row shows an error */ }
        if (mounted.current) setMkt((m) => ({ ...m, [key]: r }));
      }
    };
    void Promise.all([worker(), worker()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on which items are sold
  }, [sellKeys]);

  const floorN = Number(floor) > 0 ? Number(floor) : 0;
  const mine = data?.name ?? null;
  const priceOf = (o: MyOrder) => (price[o.id] !== undefined ? Number(price[o.id]) : o.platinum);
  const result = (o: MyOrder) => { const m = mkt[mkey(o)]; return Array.isArray(m) ? repriceSellOrder(o.platinum, m, mine, rule, floorN) : null; };

  async function call(url: string, method: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (json.reauth) refresh();
    return res.ok ? { ok: true } : { ok: false, error: json.error ?? "Warframe Market refused that." };
  }
  const note = (id: string, ok: boolean, text: string) => setRowMsg((m) => ({ ...m, [id]: { ok, text } }));
  const patchLocal = (id: string, p: Partial<MyOrder>) => setData((d) => d && { ...d, orders: d.orders.map((o) => (o.id === id ? { ...o, ...p } : o)) });

  async function save(o: MyOrder, change: { platinum?: number; visible?: boolean }) {
    const r = await call(`/api/market/orders/${o.id}`, "PATCH", change);
    if (r.ok) { patchLocal(o.id, { ...change, updatedAt: new Date().toISOString() }); setPrice((p) => { const { [o.id]: _x, ...rest } = p; void _x; return rest; }); note(o.id, true, change.platinum != null ? `Price set to ${change.platinum}p` : change.visible ? "Now visible" : "Now hidden"); }
    else note(o.id, false, r.error ?? "Failed");
    return r.ok;
  }
  async function remove(o: MyOrder, ask = true) {
    if (ask && !confirm(`Remove your ${o.type} order for ${o.item.name} from Warframe Market?`)) return false;
    const r = await call(`/api/market/orders/${o.id}`, "DELETE");
    if (r.ok) setData((d) => d && { ...d, orders: d.orders.filter((x) => x.id !== o.id) }); else note(o.id, false, r.error ?? "Failed");
    return r.ok;
  }

  const chosen = (list: MyOrder[]) => list.filter((o) => sel[o.id]);
  async function bulk(what: "reprice" | "hide" | "show" | "remove") {
    const picked = chosen(data?.orders ?? []);
    if (!picked.length) return setMsg("Tick some orders first.");
    let plan = picked;
    if (what === "reprice") {
      plan = picked.filter((o) => o.type === "sell" && (() => { const r = result(o); return r && repricedValue(o.platinum, r, allowRaise) != null; })());
      if (!plan.length) return setMsg("Nothing to change — the ticked orders are already at or below that price (or still loading market prices).");
    }
    const verb = { reprice: "Reprice", hide: "Hide", show: "Show", remove: "Remove" }[what];
    if (!confirm(`${verb} ${plan.length} order${plan.length === 1 ? "" : "s"} on Warframe Market?`)) return;
    setBusy(true); setMsg(null);
    let ok = 0;
    for (const o of plan) {
      let good = false;
      if (what === "remove") good = await remove(o, false);
      else if (what === "reprice") { const np = repricedValue(o.platinum, result(o)!, allowRaise); good = np != null && (await save(o, { platinum: np })); }
      else good = await save(o, { visible: what === "show" });
      if (good) ok++;
    }
    setBusy(false);
    setSel({});
    setMsg(`${verb}: ${ok} of ${plan.length} done${ok < plan.length ? " — see the rows marked in red." : "."}`);
  }

  const view = (list: MyOrder[]) => browseRows(list.map((o) => ({ ...o, name: o.item.name, qty: o.quantity, unit: o.platinum, total: o.platinum * o.quantity })), q, sort);
  const shownSells = view(sells), shownBuys = view(buys);
  const undercut = sells.filter((o) => result(o)?.status === "undercut");

  if (status && !status.connected) return <section className="card space-y-3"><h2 className="kicker">Connect Warframe Market</h2><p className="text-sm text-dim">Connect your account to see and manage everything you have listed.</p><WfmConnect status={status} onChange={refresh} /></section>;
  if (!status || (loading && !data)) return <div className="card text-sm text-dim">Loading your Warframe Market listings…</div>;

  const row = (o: MyOrder) => {
    const r = o.type === "sell" ? result(o) : null;
    const m = mkt[mkey(o)];
    const rm = rowMsg[o.id];
    const p = priceOf(o);
    const dirty = price[o.id] !== undefined && p !== o.platinum;
    return (
      <li key={o.id} className={`space-y-2 py-3 ${o.visible ? "" : "opacity-60"}`}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <label className="flex min-w-0 items-center gap-2">
            <input type="checkbox" checked={!!sel[o.id]} onChange={(e) => setSel((s) => ({ ...s, [o.id]: e.target.checked }))} aria-label={`Select ${o.item.name}`} />
            {o.item.thumb && <span aria-hidden="true" className="size-7 shrink-0 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${o.item.thumb})` }} />}
            <span className="min-w-0">
              <span className="block truncate text-sm text-ink">{o.item.name}{o.rank > 0 && <span className="ml-1.5 text-xs text-dim">rank {o.rank}</span>}{!o.visible && <span className="ml-1.5 text-xs text-orange">hidden</span>}</span>
              <span className="block text-xs text-dim">×{o.quantity} · updated {ago(o.updatedAt)}</span>
            </span>
          </label>
          <div className="flex items-center gap-2 text-sm">
            <input className="input w-20 text-center" type="number" min={1} inputMode="numeric" value={price[o.id] ?? o.platinum} onChange={(e) => setPrice((x) => ({ ...x, [o.id]: e.target.value }))} aria-label={`Price for ${o.item.name}`} />
            <Plat size={13} />
            <button className="btn min-h-9 px-3 text-xs" disabled={busy || !dirty || !Number.isInteger(p) || p < 1} onClick={() => save(o, { platinum: p })}>Save</button>
            <button className="btn min-h-9 px-3 text-xs" disabled={busy} onClick={() => save(o, { visible: !o.visible })}>{o.visible ? "Hide" : "Show"}</button>
            <button className="text-xs text-dim hover:text-danger" disabled={busy} onClick={() => remove(o)} aria-label={`Remove ${o.item.name}`}>remove</button>
          </div>
        </div>
        {o.type === "sell" && (
          <div className="text-xs text-dim">
            {m === undefined || m === "loading" ? "Checking the market…" : m === "error" ? "Couldn’t load market data." : r?.status === "no-market" ? "Nobody else is selling this online right now." : (
              <div className="flex flex-wrap items-center gap-1.5">
                {r?.status === "undercut" ? <span className="font-semibold text-orange">Undercut — cheapest online is {fmt(r.cheapest!)}p ({fmt(r.behind)}p below you)</span> : <span className="font-semibold text-ok">{r?.status === "cheapest" ? "You’re the cheapest" : "Matching the cheapest"}</span>}
                {r?.target != null && r.target !== o.platinum && <button className="rounded border border-line px-1.5 py-0.5 hover:border-gold/60" onClick={() => setPrice((x) => ({ ...x, [o.id]: String(r.target) }))}>use {fmt(r.target)}p</button>}
                <span>· cheapest online:</span>
                {m.map((x, i) => <button key={i} className="rounded border border-line px-1.5 py-0.5 hover:border-gold/60" title={`${x.seller} · ${x.status === "ingame" ? "in game" : "online"} — click to use this price`} onClick={() => setPrice((s) => ({ ...s, [o.id]: String(x.platinum) }))}><span className={x.status === "ingame" ? "text-ok" : "text-teal"}>●</span> {fmt(x.platinum)}p <span className="text-dim">{x.seller}</span></button>)}
              </div>
            )}
          </div>
        )}
        {rm && <p className={`text-xs ${rm.ok ? "text-ok" : "text-danger"}`}>{rm.ok ? "✓ " : "✕ "}{rm.text}</p>}
      </li>
    );
  };

  const allOrders = data?.orders ?? [];
  const setAll = (v: boolean) => setSel(Object.fromEntries(allOrders.map((o) => [o.id, v])));

  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="kicker">Warframe Market account</p>
          <p className="mt-1 text-sm text-ink">{mine ?? "Connected"} · {sells.length} sell · {buys.length} buy · {data?.auctions.length ?? 0} riven auctions</p>
          {undercut.length > 0 && <p className="mt-1 text-sm font-semibold text-orange">{undercut.length} of your sell orders {undercut.length === 1 ? "has" : "have"} been undercut.</p>}
        </div>
        <button className="btn" onClick={load} disabled={loading || busy}>{loading ? "Refreshing…" : "Refresh"}</button>
      </section>
      {salesNote > 0 && <p role="status" className="card border-gold/40 text-sm text-ink">{salesNote} of your orders look like they sold. <a href="/inventory/sales" className="text-gold underline">Review them in Sales →</a></p>}
      {err && <p role="alert" className="card border-danger/40 text-sm text-danger">{err}</p>}

      {allOrders.length > 0 && (
        <section className="card space-y-4">
          <h2 className="kicker">Bulk actions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="rp-rule">Reprice sell orders by</label>
              <select id="rp-rule" className="input" value={rule} onChange={(e) => setRule(e.target.value as RepriceRule)}>{REPRICE_RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
              <p className="mt-1 text-xs text-dim">{REPRICE_RULES.find((r) => r.value === rule)?.help}</p>
            </div>
            <div>
              <label className="label" htmlFor="rp-floor">Never go below (platinum)</label>
              <input id="rp-floor" className="input" type="number" min={0} inputMode="numeric" placeholder="No floor" value={floor} onChange={(e) => { setFloor(e.target.value); try { localStorage.setItem(MIN_KEY, e.target.value); } catch { /* ignore */ } }} />
              <label className="mt-2 flex items-center gap-2 text-xs text-dim"><input type="checkbox" checked={allowRaise} onChange={(e) => setAllowRaise(e.target.checked)} /> Also raise prices that are below the rule (otherwise it only ever lowers them)</label>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn min-h-9 px-3 text-xs" onClick={() => setAll(true)}>Select all</button>
            <button className="btn min-h-9 px-3 text-xs" onClick={() => setSel(Object.fromEntries(undercut.map((o) => [o.id, true])))} disabled={!undercut.length}>Select undercut ({undercut.length})</button>
            <button className="btn min-h-9 px-3 text-xs" onClick={() => setAll(false)}>None</button>
            <span className="text-xs text-dim">{chosen(allOrders).length} selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => bulk("reprice")} disabled={busy}>Reprice selected</button>
            <button className="btn" onClick={() => bulk("hide")} disabled={busy}>Hide selected</button>
            <button className="btn" onClick={() => bulk("show")} disabled={busy}>Show selected</button>
            <button className="btn-danger" onClick={() => bulk("remove")} disabled={busy}>Remove selected</button>
          </div>
          {msg && <p role="status" className="text-sm text-ink">{msg}</p>}
        </section>
      )}

      {allOrders.length > 1 && <InventoryFilter q={q} onQ={setQ} sort={sort} onSort={setSort} shown={shownSells.length + shownBuys.length} total={allOrders.length} />}

      <section className="card space-y-1">
        <h2 className="kicker">Sell orders</h2>
        {shownSells.length === 0 ? <p className="text-sm text-dim">{sells.length ? "Nothing matches." : "You have no sell orders listed."}</p> : <ul className="divide-y divide-line">{shownSells.map(row)}</ul>}
      </section>
      {(buys.length > 0) && (
        <section className="card space-y-1">
          <h2 className="kicker">Buy orders</h2>
          <ul className="divide-y divide-line">{shownBuys.map(row)}</ul>
        </section>
      )}
      {(data?.auctions.length ?? 0) > 0 && <Auctions auctions={data!.auctions} onChange={(a) => setData((d) => d && { ...d, auctions: a })} onAuthFail={refresh} />}
    </div>
  );
}

function Auctions({ auctions, onChange, onAuthFail }: { auctions: MyAuction[]; onChange: (a: MyAuction[]) => void; onAuthFail: () => void }) {
  const [price, setPrice] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [busy, setBusy] = useState(false);
  async function call(a: MyAuction, method: "PUT" | "DELETE", body?: unknown) {
    setBusy(true);
    const res = await fetch(`/api/market/auctions/${a.id}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (json.reauth) onAuthFail();
    return { ok: res.ok, error: json.error as string | undefined };
  }
  return (
    <section className="card space-y-1">
      <h2 className="kicker">Riven auctions</h2>
      <ul className="divide-y divide-line">
        {auctions.map((a) => {
          const p = Number(price[a.id] ?? a.price);
          const n = note[a.id];
          return (
            <li key={a.id} className="space-y-1 py-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <span className="min-w-0 text-sm text-ink"><span className="capitalize">{a.weapon?.replace(/_/g, " ") ?? "Riven"}</span> <span className="text-violet">{a.name}</span>{a.rank != null && <span className="ml-2 text-xs text-dim">rank {a.rank}{a.rerolls != null && ` · ${a.rerolls} rerolls`}</span>}</span>
                <div className="flex items-center gap-2 text-sm">
                  <input className="input w-24 text-center" type="number" min={1} inputMode="numeric" value={price[a.id] ?? a.price} onChange={(e) => setPrice((x) => ({ ...x, [a.id]: e.target.value }))} aria-label={`Price for ${a.name}`} />
                  <Plat size={13} />
                  <button className="btn min-h-9 px-3 text-xs" disabled={busy || p === a.price || !Number.isInteger(p) || p < 1} onClick={async () => { const r = await call(a, "PUT", { price: p, note: a.note, visible: a.visible }); if (r.ok) { onChange(auctions.map((x) => (x.id === a.id ? { ...x, price: p } : x))); setNote((m) => ({ ...m, [a.id]: { ok: true, text: `Price set to ${p}p` } })); } else setNote((m) => ({ ...m, [a.id]: { ok: false, text: r.error ?? "Failed" } })); }}>Save</button>
                  <a className="text-xs text-teal hover:underline" href={`https://warframe.market/auction/${a.id}`} target="_blank" rel="noopener noreferrer">view ↗</a>
                  <button className="text-xs text-dim hover:text-danger" disabled={busy} onClick={async () => { if (!confirm(`Close your auction for ${a.name}?`)) return; const r = await call(a, "DELETE"); if (r.ok) onChange(auctions.filter((x) => x.id !== a.id)); else setNote((m) => ({ ...m, [a.id]: { ok: false, text: r.error ?? "Failed" } })); }}>close</button>
                </div>
              </div>
              {n && <p className={`text-xs ${n.ok ? "text-ok" : "text-danger"}`}>{n.ok ? "✓ " : "✕ "}{n.text}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
