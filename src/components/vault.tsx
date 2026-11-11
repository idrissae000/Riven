"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Plat } from "@/components/brand";
import { needsRefresh, vaultTotals, type VaultEstimate } from "@/lib/vault";

interface Ctx {
  ids: string[];
  est: Record<string, VaultEstimate | undefined>;
  loading: Set<string>;
  failed: Set<string>;
  running: boolean;
  done: number;
  todo: number;
  repriceAll: () => void;
}
const VaultContext = createContext<Ctx | null>(null);
const useVault = () => {
  const c = useContext(VaultContext);
  if (!c) throw new Error("Vault components must be inside <VaultProvider>");
  return c;
};

async function priceOne(id: string, force: boolean): Promise<VaultEstimate> {
  const res = await fetch(`/api/rivens/${id}/market${force ? "?refresh=1" : ""}`);
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.error ?? "Market lookup failed"), { status: res.status });
  const e = json.estimate as { low: number; median: number; high: number; confidence: string } | null;
  return { low: e?.low ?? null, median: e?.median ?? null, high: e?.high ?? null, confidence: e?.confidence ?? null, at: new Date().toISOString() };
}

/**
 * Holds every riven's last estimate (from the database), re-prices the stale or never-priced ones in the background —
 * one at a time, so Warframe Market's rate limit is respected — and shares the results with the cards and the total.
 */
export function VaultProvider({ initial, children }: { initial: Record<string, VaultEstimate>; children: React.ReactNode }) {
  const ids = useMemo(() => Object.keys(initial), [initial]);
  const [est, setEst] = useState<Record<string, VaultEstimate | undefined>>(initial);
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ done: 0, todo: 0, running: false });
  const current = useRef<{ cancelled: boolean } | null>(null); // the running queue; setting cancelled stops it

  const price = useCallback(async (queue: string[], force: boolean, token: { cancelled: boolean }) => {
    if (current.current && current.current !== token) current.current.cancelled = true;
    current.current = token;
    setFailed(new Set());
    setProgress({ done: 0, todo: queue.length, running: queue.length > 0 });
    for (let i = 0; i < queue.length; i++) {
      if (token.cancelled) return;
      const id = queue[i];
      setLoading((s) => new Set(s).add(id));
      try {
        const e = await priceOne(id, force);
        if (token.cancelled) return;
        setEst((m) => ({ ...m, [id]: e }));
      } catch (err) {
        if (token.cancelled) return;
        setFailed((s) => new Set(s).add(id));
        if ((err as { status?: number }).status === 429) { setProgress((p) => ({ ...p, running: false })); setLoading(new Set()); return; } // rate limited: stop, keep what we have
      } finally {
        if (!token.cancelled) setLoading((s) => { const n = new Set(s); n.delete(id); return n; });
      }
      setProgress({ done: i + 1, todo: queue.length, running: i + 1 < queue.length });
    }
  }, []);

  useEffect(() => {
    const token = { cancelled: false };
    const stale = ids.filter((id) => needsRefresh(initial[id]));
    // started on the next tick so the effect itself doesn't set state
    const t = stale.length ? setTimeout(() => void price(stale, false, token), 0) : undefined;
    return () => { token.cancelled = true; if (t) clearTimeout(t); };
  }, [ids, initial, price]);

  const value: Ctx = { ids, est, loading, failed, running: progress.running, done: progress.done, todo: progress.todo, repriceAll: () => void price(ids, true, { cancelled: false }) };
  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

const fmt = (n: number) => n.toLocaleString("en-US");

/** The whole vault's estimated worth: the sum of every riven's estimate. */
export function VaultWorth() {
  const { ids, est, running, done, todo, repriceAll } = useVault();
  const t = vaultTotals(ids, est);
  return (
    <section className="card flex flex-wrap items-center justify-between gap-3" aria-live="polite">
      <div>
        <p className="kicker">Vault worth</p>
        <p className="h-display flex items-center gap-2 text-4xl text-plat">
          {t.priced ? <>≈ {fmt(t.median)} <Plat size={26} /></> : <span className="text-dim">{running ? "Pricing…" : "—"}</span>}
        </p>
        <p className="mt-1 text-xs text-dim">
          {t.priced > 0 && <>range {fmt(t.low)}–{fmt(t.high)} · </>}
          {t.priced} of {t.total} rivens priced
          {t.priced < t.total && !running && " (the rest have too few comparable listings)"}
          {running && ` · pricing ${Math.min(done + 1, todo)}/${todo}…`}
        </p>
      </div>
      <button className="btn min-h-9 px-3 text-xs" onClick={repriceAll} disabled={running}>↻ Re-price all</button>
    </section>
  );
}

/** One card's price, bottom-right. */
export function RivenPrice({ id }: { id: string }) {
  const { est, loading, failed } = useVault();
  const e = est[id];
  const busy = loading.has(id);
  return (
    <div className="mt-3 flex min-h-9 items-end justify-end text-right">
      {e?.median != null ? (
        <div title={`${e.confidence ?? ""} confidence`}>
          <p className={`h-display flex items-center justify-end gap-1.5 text-xl text-plat ${busy ? "opacity-60" : ""}`}>≈ {fmt(e.median)} <Plat size={16} /></p>
          <p className="font-mono text-[0.65rem] text-dim">{fmt(e.low ?? e.median)}–{fmt(e.high ?? e.median)}{e.confidence === "low" ? " · low confidence" : ""}</p>
        </div>
      ) : busy ? (
        <span className="h-5 w-20 animate-pulse bg-panel-2" aria-label="pricing" />
      ) : (
        <span className="text-xs text-dim">{failed.has(id) ? "price unavailable" : e?.at ? "no estimate" : "—"}</span>
      )}
    </div>
  );
}
