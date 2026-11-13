"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plat } from "@/components/brand";
import { WfmConnect, useWfmStatus } from "@/components/wfm-connect";
import { RIVEN_STRATEGIES, cheapestOnlineRivens, rivenAutoPrice, type MarketEstimate, type MarketListing, type RivenStrategy } from "@/lib/wfm/riven-price";

export interface ListableRiven { id: string; label: string; hasName: boolean; listed: { auctionId: string; price: number | null } | null }

type Market = { estimate: MarketEstimate | null; online: MarketListing[] } | "loading" | "error";
interface Outcome { ok: boolean; error?: string }
const MIN_KEY = "riven-list-min-price-rivens";
const fmt = (n: number) => String(Math.round(n));

/** List rivens on Warframe Market one at a time (each row has its own button) or all at once, priced by the app, with the cheapest online comparable rivens shown. */
export function RivenListPanel({ rivens }: { rivens: ListableRiven[] }) {
  const router = useRouter();
  const { status, refresh } = useWfmStatus();
  const [open, setOpen] = useState(false);
  const [strategy, setStrategy] = useState<RivenStrategy>("median");
  const [minPrice, setMinPriceState] = useState(() => { try { return localStorage.getItem(MIN_KEY) ?? ""; } catch { return ""; } });
  const setMinPrice = (v: string) => { setMinPriceState(v); try { localStorage.setItem(MIN_KEY, v); } catch { /* ignore */ } };
  const [market, setMarket] = useState<Record<string, Market>>({});
  const [price, setPrice] = useState<Record<string, string>>({});
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [out, setOut] = useState<Record<string, Outcome>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const asked = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const unlisted = rivens.filter((r) => !r.listed);
  const unlistedKey = unlisted.map((r) => r.id).join("|");

  // Market data (estimate + comparable listings) for each unlisted riven, two at a time, once the panel is opened.
  useEffect(() => {
    if (!open) return;
    const todo = unlisted.filter((r) => !asked.current.has(r.id));
    if (!todo.length) return;
    todo.forEach((r) => asked.current.add(r.id));
    const queue = [...todo];
    const worker = async () => {
      for (let r = queue.shift(); r && mounted.current; r = queue.shift()) {
        const id = r.id;
        setMarket((m) => ({ ...m, [id]: "loading" }));
        let result: Market = "error";
        try {
          const res = await fetch(`/api/rivens/${id}/market`);
          if (res.ok) { const j = await res.json(); result = { estimate: j.estimate ?? null, online: cheapestOnlineRivens(j.listings) }; }
        } catch { /* the row can still be priced by hand */ }
        if (mounted.current) setMarket((m) => ({ ...m, [id]: result }));
      }
    };
    void Promise.all([worker(), worker()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the set of unlisted rivens
  }, [open, unlistedKey]);

  const min = Number(minPrice) > 0 ? Number(minPrice) : 0;
  const auto = (r: ListableRiven) => { const m = market[r.id]; return m && typeof m === "object" ? rivenAutoPrice(m.estimate, m.online, strategy) : null; };
  const priceFor = (r: ListableRiven) => (price[r.id] !== undefined ? Number(price[r.id]) : auto(r));
  const belowMin = (r: ListableRiven) => { const p = priceFor(r); return min > 0 && p != null && p < min; };
  const included = (r: ListableRiven) => r.hasName && !off[r.id] && !belowMin(r) && !out[r.id]?.ok;
  const valid = (p: number | null): p is number => p != null && Number.isInteger(p) && p >= 1;

  async function pushOne(r: ListableRiven, p: number): Promise<boolean> {
    const res = await fetch(`/api/rivens/${r.id}/push`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ price: p }) });
    const json = await res.json().catch(() => ({}));
    if (json.reauth) refresh();
    setOut((o) => ({ ...o, [r.id]: res.ok ? { ok: true } : { ok: false, error: json.error ?? "Could not list the riven." } }));
    return res.ok;
  }

  async function listOne(r: ListableRiven) {
    const p = priceFor(r);
    if (!valid(p)) return setMsg("Enter a whole-number price first.");
    if (!confirm(`List ${r.label} on Warframe Market for ${p} platinum?`)) return;
    setBusy(true); setMsg(null);
    await pushOne(r, p);
    setBusy(false);
    router.refresh();
  }

  async function listAll() {
    const items = unlisted.flatMap((r) => { const p = auto(r); return included(r) && valid(p) ? [{ r, p }] : []; });
    if (!items.length) return setMsg("Nothing to list yet — wait for prices to load, or set a price by hand.");
    const worth = items.reduce((s, i) => s + i.p, 0);
    if (!confirm(`List ${items.length} riven${items.length === 1 ? "" : "s"} on Warframe Market as ${status?.name ?? "your account"}, worth about ${worth} platinum in total? They go up right away.`)) return;
    setBusy(true); setMsg(null);
    let failed = 0;
    for (const { r, p } of items) if (!(await pushOne(r, p))) failed++;
    setBusy(false);
    setMsg(failed ? `Done — ${failed} couldn’t be listed (see below).` : "All listed on Warframe Market.");
    router.refresh();
  }

  const loading = unlisted.filter((r) => market[r.id] === undefined || market[r.id] === "loading").length;
  const connected = !!status?.connected;

  if (!open)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={() => setOpen(true)} disabled={unlisted.length === 0}>List rivens on Warframe Market</button>
        <span className="text-xs text-dim">{unlisted.length} not listed yet · {rivens.length - unlisted.length} listed. List all at once, or one at a time with your own price.</span>
      </div>
    );

  return (
    <section className="card space-y-4" aria-label="List rivens on Warframe Market">
      <div className="flex items-center justify-between gap-2">
        <h2 className="kicker">List rivens on Warframe Market</h2>
        <button className="btn min-h-9 px-3 text-xs" onClick={() => setOpen(false)}>Close</button>
      </div>
      <WfmConnect status={status} onChange={refresh} />

      {connected && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="riv-strategy">How should the app price them?</label>
              <select id="riv-strategy" className="input" value={strategy} onChange={(e) => { setStrategy(e.target.value as RivenStrategy); setPrice({}); }}>
                {RIVEN_STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-dim">{RIVEN_STRATEGIES.find((s) => s.value === strategy)?.help} Changing this resets any prices you typed.</p>
            </div>
            <div>
              <label className="label" htmlFor="riv-min">Only list rivens worth at least (platinum)</label>
              <input id="riv-min" className="input" type="number" min={0} inputMode="numeric" placeholder="No minimum" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              {min > 0 && <p className="mt-1 text-xs text-dim">{unlisted.filter(belowMin).length} riven(s) are below {min}p right now.</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" onClick={listAll} disabled={busy || loading === unlisted.length}>
              {busy ? "Listing…" : `Auto-price & list all (${unlisted.filter((r) => included(r) && valid(auto(r))).length})`}
            </button>
            {loading > 0 && <span className="text-xs text-dim">Loading market prices… {unlisted.length - loading}/{unlisted.length}</span>}
          </div>
          {msg && <p role="status" className="text-sm text-ink">{msg}</p>}
        </>
      )}

      <ul className="divide-y divide-line">
        {rivens.map((r) => {
          const m = market[r.id];
          const o = out[r.id];
          const p = priceFor(r);
          const low = !r.listed && belowMin(r);
          return (
            <li key={r.id} className={`space-y-2 py-3 ${low || off[r.id] ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 items-center gap-2">
                  {!r.listed && <input type="checkbox" checked={!off[r.id] && !low && r.hasName} disabled={!r.hasName || low || o?.ok} onChange={(e) => setOff((x) => ({ ...x, [r.id]: !e.target.checked }))} aria-label={`Include ${r.label}`} />}
                  <Link href={`/rivens/${r.id}`} className="min-w-0 truncate text-sm text-ink hover:text-gold">{r.label}</Link>
                  {low && <span className="shrink-0 text-xs font-semibold text-orange">below {min}p</span>}
                </div>
                {r.listed ? (
                  <span className="text-sm text-ok">Listed{r.listed.price ? ` for ${r.listed.price}p` : ""} · <a className="text-teal hover:underline" href={`https://warframe.market/auction/${r.listed.auctionId}`} target="_blank" rel="noopener noreferrer">view ↗</a></span>
                ) : !r.hasName ? (
                  <span className="text-xs text-dim">Add the riven’s name (edit it) to list — Warframe Market requires it.</span>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <input className="input w-24 text-center" type="number" min={1} inputMode="numeric" value={price[r.id] ?? (auto(r) ?? "")} placeholder="price" aria-label={`Price for ${r.label}`} onChange={(e) => setPrice((x) => ({ ...x, [r.id]: e.target.value }))} />
                    <Plat size={13} />
                    <button className="btn min-h-9 px-3 text-xs" onClick={() => listOne(r)} disabled={busy || !connected || o?.ok || !valid(p)}>List now</button>
                  </div>
                )}
              </div>
              {!r.listed && r.hasName && (
                <div className="text-xs text-dim">
                  {m === undefined || m === "loading" ? "Loading the cheapest online comparable rivens…"
                    : m === "error" ? "Couldn’t load market data — set a price by hand."
                    : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {m.estimate && <span className="mr-1">Estimate <span className="text-plat">{fmt(m.estimate.low)}–{fmt(m.estimate.high)}p</span> (median {fmt(m.estimate.median)}p) ·</span>}
                        {m.online.length === 0 ? <span>no comparable rivens for sale by online players — set a price by hand.</span> : <span>Cheapest online matches:</span>}
                        {m.online.map((x) => (
                          <button key={x.id} className={`rounded border px-1.5 py-0.5 ${p === x.price ? "border-gold text-gold" : "border-line hover:border-gold/60"}`} title={`${x.seller} · ${x.sellerStatus === "ingame" ? "in game" : "online"} · ${x.matchKind === "exact" ? "same stats" : "similar stats"} — click to use this price`} onClick={() => setPrice((s) => ({ ...s, [r.id]: String(x.price) }))}>
                            <span className={x.sellerStatus === "ingame" ? "text-ok" : "text-teal"}>●</span> {fmt(x.price)}p <span className="text-dim">{x.seller}</span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              )}
              {o && <p className={`text-xs ${o.ok ? "text-ok" : "text-danger"}`}>{o.ok ? "✓ Listed on Warframe Market" : `✕ ${o.error}`}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
