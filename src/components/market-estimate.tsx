"use client";

import { useEffect, useState } from "react";
import type { Estimate, Listing } from "@/lib/wfm/comparables";
import { fmtStat, timeAgo } from "@/lib/format";
import { Plat } from "@/components/brand";
import { GradeBadge } from "@/components/grade-badge";

interface Result {
  estimate: Estimate | null;
  listings: Listing[];
  fetchedAt: string;
  fromCache: boolean;
  stale: boolean;
  note: string | null;
}

async function fetchMarket(endpoint: string, refresh: boolean): Promise<Result> {
  const res = await fetch(refresh ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}refresh=1` : endpoint);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Market lookup failed");
  return json;
}

const statusColor: Record<string, string> = { ingame: "bg-ok", online: "bg-teal", offline: "bg-dim/50" };

/** `endpoint` returns the market result: /api/rivens/<id>/market (saved) or /api/market/riven?r=… (unsaved). */
export function MarketEstimate({ endpoint, attrs }: { endpoint: string; attrs: Record<string, { name: string; unit: string | null }> }) {
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchMarket(endpoint, false)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Market lookup failed"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [endpoint]);

  function refresh() {
    setLoading(true);
    setError(null);
    fetchMarket(endpoint, true)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Market lookup failed"))
      .finally(() => setLoading(false));
  }

  // Hard rule: a price is only ever shown together with the listings that back it.
  const est = data && data.listings.length > 0 ? data.estimate : null;

  return (
    <section className="card space-y-4" aria-busy={loading}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="kicker">Market estimate</h2>
        <button className="btn min-h-9 px-3 text-xs" onClick={refresh} disabled={loading}>{loading ? "Loading…" : "↻ Refresh"}</button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {loading && !data && <div className="h-24 animate-pulse bg-panel-2" />}

      {data && (
        <>
          {est ? (
            <div className="rounded-lg border border-orange/30 bg-orange/5 p-4">
              <div className="font-display text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-dim">Estimated range</div>
              <div className="h-display flex items-center gap-2 text-4xl text-plat">{est.low}–{est.high} <Plat size={26} /></div>
              <div className="text-sm text-dim">median {est.median} plat · from {est.sampleSize} {est.basis === "exact" ? "same-stat" : "similar-stat"} listings below</div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <span className={`chip ${est.confidence === "high" ? "border-teal/50 text-teal" : est.confidence === "low" ? "border-orange/50 text-orange" : ""}`}>{est.confidence} confidence</span>
                {est.adjusted && <span className="chip" title="Each listing’s asking price is adjusted for how its roll quality compares with yours">adjusted for roll quality</span>}
                {est.outliers > 0 && <span className="chip" title="Troll or mispriced asks, found statistically and left out">{est.outliers} price outlier{est.outliers === 1 ? "" : "s"} excluded</span>}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-line bg-panel-2 p-3 text-sm text-dim">No price estimate. {data.note}</p>
          )}
          {est && data.note && <p className="text-xs text-violet">{data.note}</p>}
          {data.stale && <p className="text-xs text-orange">Warframe Market didn’t respond — showing older cached data.</p>}

          <div>
            <h3 className="label">Listings used {data.listings.length > 0 && `(${data.listings.length})`}</h3>
            <ul className="space-y-2">
              {data.listings.map((l) => (
                <li key={l.id} className={`rounded-lg border border-line bg-void/40 p-3 ${l.outlier ? "opacity-50" : ""}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-baseline gap-2">
                      <span className={`h-display flex items-center gap-1.5 text-2xl text-plat ${l.outlier ? "line-through" : ""}`}>{l.price}<Plat size={16} /></span>
                      {l.outlier ? <span className="text-xs text-orange">excluded: price outlier</span>
                        : l.adjustedPrice != null && l.adjustedPrice !== l.price && <span className="text-xs text-dim" title="What this ask counts as once adjusted for roll quality">counts as ≈{l.adjustedPrice}</span>}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-dim">
                      <span className={`inline-block size-2 rounded-full ${statusColor[l.sellerStatus] ?? "bg-dim/50"}`} />
                      <a className="text-teal hover:underline" href={l.sellerUrl} target="_blank" rel="noopener noreferrer">{l.seller}</a>
                      · {timeAgo(l.postedAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-violet">{l.rivenName}</span>
                    <span className={`chip ${l.matchKind === "exact" ? "border-teal/50 text-teal" : ""}`}>{l.matchKind === "exact" ? "same stats" : `${l.matched} of ${l.total} stats`}</span>
                    <span className="chip">rank {l.rank}</span>
                    <span className="chip">{l.rerolls} rerolls</span>
                  </div>
                  <ul className="mt-2 grid gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-2">
                    {l.stats.map((s, i) => (
                      <li key={s.stat} className={`flex items-center gap-2 ${s.positive ? "" : "text-danger"}`}>
                        {l.grades && <GradeBadge tier={l.grades[i] ?? null} size="sm" />}
                        <span>{fmtStat(s.value, attrs[s.stat]?.unit)} <span className="font-sans text-dim">{attrs[s.stat]?.name ?? s.stat}</span></span>
                      </li>
                    ))}
                  </ul>
                  <a className="mt-2 inline-block text-xs text-dim hover:text-teal" href={l.url} target="_blank" rel="noopener noreferrer">View on Warframe Market ↗</a>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-dim">
            Live buy-it-now asking prices, not completed sales. Each ask is adjusted for roll quality, price outliers are dropped, and fresher, closer-matching, in-game sellers count more. Values compared at max rank. Data fetched {timeAgo(data.fetchedAt)}{data.fromCache ? " (cached ≤12 min)" : ""}.
          </p>
        </>
      )}
    </section>
  );
}
