"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const MIN_KEY = "riven-list-min-price";
import { Plat } from "@/components/brand";
import { InventoryFilter } from "@/components/inventory-filter";
import { browseRows, type InvSort } from "@/lib/inventory/browse";
import { WfmConnect, useWfmStatus } from "@/components/wfm-connect";
import { ducatVerdict } from "@/lib/primes/ducats";
import { STRATEGIES, autoPrice, type Listing, type PriceStrategy } from "@/lib/wfm/listings";

export interface SellRow { slug: string; name: string; qty: number; unit: number | null; ducats: number | null }

type Fetched = Listing[] | "loading" | "error";
interface Outcome { ok: boolean; error?: string }
const CHUNK = 10;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Set prices (with the 5 cheapest online listings beside each) or let the app price everything, then list it on Warframe Market. */
export function ListOnMarket({ rows, onClose }: { rows: SellRow[]; onClose: () => void }) {
  const { status, refresh } = useWfmStatus();
  const [strategy, setStrategy] = useState<PriceStrategy>("market");
  const [skipDucat, setSkipDucat] = useState(true);
  // only list parts priced at or above this (platinum each); blank = no minimum. Remembered between visits (this panel only mounts in the browser, after a click).
  const [minPrice, setMinPriceState] = useState(() => { try { return localStorage.getItem(MIN_KEY) ?? ""; } catch { return ""; } });
  const setMinPrice = (v: string) => { setMinPriceState(v); try { localStorage.setItem(MIN_KEY, v); } catch { /* ignore */ } };
  const [listings, setListings] = useState<Record<string, Fetched>>({});
  const [price, setPrice] = useState<Record<string, string>>({}); // user-typed prices (win over the strategy)
  const [qty, setQty] = useState<Record<string, number>>({});
  const [off, setOff] = useState<Record<string, boolean>>({}); // rows the user unticked
  const [out, setOut] = useState<Record<string, Outcome>>({});
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<InvSort>("price");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const asked = useRef(new Set<string>());

  // Fetch the 5 cheapest online listings for every row, two at a time, most valuable first (the server throttles Warframe Market).
  useEffect(() => {
    const todo = rows.map((r) => r.slug).filter((s) => !asked.current.has(s));
    if (!todo.length) return;
    todo.forEach((s) => asked.current.add(s));
    let alive = true;
    const queue = [...todo];
    const worker = async () => {
      for (let slug = queue.shift(); slug && alive; slug = queue.shift()) {
        setListings((l) => ({ ...l, [slug]: "loading" }));
        let result: Fetched = "error";
        try {
          const res = await fetch(`/api/primes/listings?slug=${encodeURIComponent(slug)}`);
          if (res.ok) result = ((await res.json()) as { listings: Listing[] }).listings;
        } catch { /* shown as an error; the row can still be priced by hand */ }
        if (alive) setListings((l) => ({ ...l, [slug]: result }));
      }
    };
    void Promise.all([worker(), worker()]);
    return () => { alive = false; };
  }, [rows]);

  const skipped = (r: SellRow) => skipDucat && ducatVerdict(r.unit, r.ducats) === "ducat";
  const auto = (r: SellRow) => { const l = listings[r.slug]; return Array.isArray(l) ? autoPrice(l, strategy) : null; };
  const priceFor = (r: SellRow) => (price[r.slug] !== undefined ? Number(price[r.slug]) : auto(r));
  const qtyFor = (r: SellRow) => qty[r.slug] ?? r.qty;
  const min = Number(minPrice) > 0 ? Number(minPrice) : 0;
  const belowMin = (r: SellRow) => { const p = priceFor(r); return min > 0 && p != null && p < min; };
  const included = (r: SellRow) => !off[r.slug] && !skipped(r) && !belowMin(r);

  const plan = useMemo(() => {
    let n = 0, total = 0;
    for (const r of rows) {
      const p = priceFor(r);
      if (included(r) && p != null && Number.isInteger(p) && p >= 1) { n++; total += p * qtyFor(r); }
    }
    return { n, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- priceFor/qtyFor/included read these same inputs
  }, [rows, listings, strategy, price, qty, off, skipDucat, min]);

  async function send(items: { row: SellRow; platinum: number }[]) {
    setBusy(true); setMsg(null);
    let failed = 0;
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK);
      let res: Response;
      try {
        res = await fetch("/api/primes/list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: chunk.map((c) => ({ slug: c.row.slug, platinum: c.platinum, quantity: qtyFor(c.row) })) }) });
      } catch {
        setMsg("Lost the connection — what was already listed is on Warframe Market; the rest wasn’t sent."); break;
      }
      const json = (await res.json().catch(() => ({}))) as { results?: { slug: string; ok: boolean; error?: string }[]; error?: string; reauth?: boolean };
      if (json.reauth) refresh();
      const results = json.results ?? [];
      setOut((o) => ({ ...o, ...Object.fromEntries(results.map((r) => [r.slug, { ok: r.ok, error: r.error }])) }));
      failed += results.filter((r) => !r.ok).length;
      if (!res.ok) { setMsg(json.error ?? "The listing didn’t go through."); break; }
    }
    setBusy(false);
    setMsg((m) => m ?? (failed ? `Done — ${failed} item${failed === 1 ? "" : "s"} couldn’t be listed (see below).` : "All listed on Warframe Market."));
  }

  function listPlanned(useStrategy: boolean) {
    const items = rows.flatMap((r) => {
      if (!included(r) || out[r.slug]?.ok) return [];
      const p = useStrategy ? auto(r) : priceFor(r);
      return p != null && Number.isInteger(p) && p >= 1 ? [{ row: r, platinum: p }] : [];
    });
    if (!items.length) return setMsg("Nothing to list yet — wait for prices to load, or set a price by hand.");
    const worth = items.reduce((s, i) => s + i.platinum * qtyFor(i.row), 0);
    if (!confirm(`List ${items.length} item${items.length === 1 ? "" : "s"} on Warframe Market as ${status?.name ?? "your account"}, worth about ${fmt(worth)} platinum in total? They go up as visible sell orders right away.`)) return;
    void send(items);
  }

  const shownRows = useMemo(() => browseRows(rows, q, sort), [rows, q, sort]);
  const loadingCount = rows.filter((r) => listings[r.slug] === undefined || listings[r.slug] === "loading").length;
  const connected = !!status?.connected;

  return (
    <section className="card space-y-4" aria-label="List on Warframe Market">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="kicker">List on Warframe Market</h2>
        <button className="btn min-h-9 px-3 text-xs" onClick={onClose}>Close</button>
      </div>

      <WfmConnect status={status} onChange={refresh} />

      {connected && (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="label" htmlFor="strategy">How should the app price them?</label>
              <select id="strategy" className="input" value={strategy} onChange={(e) => { setStrategy(e.target.value as PriceStrategy); setPrice({}); }}>
                {STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-dim">{STRATEGIES.find((s) => s.value === strategy)?.help} Changing this resets any prices you typed.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-dim"><input type="checkbox" checked={skipDucat} onChange={(e) => setSkipDucat(e.target.checked)} /> Skip parts better as ducats</label>
          </div>
          <div className="max-w-xs">
            <label className="label" htmlFor="min-price">Only list parts worth at least (platinum each)</label>
            <input id="min-price" className="input" type="number" min={0} inputMode="numeric" placeholder="No minimum" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
            <p className="mt-1 text-xs text-dim">Parts priced below this stay off Warframe Market. It applies to the price each part would be listed at, in both list buttons.{min > 0 && ` ${rows.filter((r) => belowMin(r)).length} part(s) are below ${min}p right now.`}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" onClick={() => listPlanned(true)} disabled={busy || loadingCount === rows.length}>
              {busy ? "Listing…" : `Auto-price & list everything (${rows.filter((r) => included(r) && !out[r.slug]?.ok && auto(r) != null).length})`}
            </button>
            <button className="btn" onClick={() => listPlanned(false)} disabled={busy || plan.n === 0}>List with the prices below ({plan.n} · ≈ {fmt(plan.total)}p)</button>
            {loadingCount > 0 && <span className="text-xs text-dim">Loading market prices… {rows.length - loadingCount}/{rows.length}</span>}
          </div>
          {msg && <p role="status" className="text-sm text-ink">{msg}</p>}
        </>
      )}

      <InventoryFilter q={q} onQ={setQ} sort={sort} onSort={setSort} shown={shownRows.length} total={rows.length} />
      <ul className="divide-y divide-line">
        {shownRows.map((r) => {
          const l = listings[r.slug];
          const p = priceFor(r);
          const o = out[r.slug];
          const skip = skipped(r);
          const low = belowMin(r);
          return (
            <li key={r.slug} className={`space-y-2 py-3 ${skip || low || off[r.slug] ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <label className="flex min-w-0 items-center gap-2">
                  <input type="checkbox" checked={!off[r.slug] && !skip && !low} disabled={skip || low || o?.ok} onChange={(e) => setOff((x) => ({ ...x, [r.slug]: !e.target.checked }))} aria-label={`Include ${r.name}`} />
                  <span className="min-w-0 truncate text-sm text-ink">{r.name}</span>
                  {skip && <span className="shrink-0 text-xs font-semibold text-violet">ducat it</span>}
                  {!skip && low && <span className="shrink-0 text-xs font-semibold text-orange">below {min}p</span>}
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-dim">×</span>
                  <input className="input w-16 text-center" type="number" min={1} max={9999} value={qtyFor(r)} aria-label={`Quantity of ${r.name} to list`} onChange={(e) => setQty((x) => ({ ...x, [r.slug]: Math.max(1, Number(e.target.value) || 1) }))} />
                  <span className="text-dim">@</span>
                  <input className="input w-20 text-center" type="number" min={1} inputMode="numeric" value={price[r.slug] ?? (auto(r) ?? "")} placeholder="price" aria-label={`Price for ${r.name}`} onChange={(e) => setPrice((x) => ({ ...x, [r.slug]: e.target.value }))} />
                  <Plat size={13} />
                </div>
              </div>

              <div className="text-xs text-dim">
                {l === undefined || l === "loading" ? "Loading the cheapest online listings…"
                  : l === "error" ? "Couldn’t load listings — set a price by hand."
                  : l.length === 0 ? "Nobody is selling this online right now — set a price by hand."
                  : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>Cheapest online:</span>
                      {l.map((x, i) => (
                        <button key={i} className={`rounded border px-1.5 py-0.5 ${p === x.platinum ? "border-gold text-gold" : "border-line hover:border-gold/60"}`} title={`${x.seller} · ${x.status === "ingame" ? "in game" : "online"}${x.quantity > 1 ? ` · ${x.quantity} available` : ""} — click to use this price`} onClick={() => setPrice((s) => ({ ...s, [r.slug]: String(x.platinum) }))}>
                          <span className={x.status === "ingame" ? "text-ok" : "text-teal"}>●</span> {fmt(x.platinum)}p{x.quantity > 1 ? ` ×${x.quantity}` : ""} <span className="text-dim">{x.seller}</span>
                        </button>
                      ))}
                    </div>
                  )}
              </div>
              {o && <p className={`text-xs ${o.ok ? "text-ok" : "text-danger"}`}>{o.ok ? "✓ Listed on Warframe Market" : `✕ ${o.error}`}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
