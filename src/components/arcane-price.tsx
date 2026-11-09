"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";
import { Plat } from "@/components/brand";
import type { ArcanePriceSummary } from "@/lib/arcanes/price-reduce";

type Result = ArcanePriceSummary & { fetchedAt: string; fromCache: boolean; stale: boolean };
const dot: Record<string, string> = { ingame: "bg-ok", online: "bg-teal", offline: "bg-dim/50" };

async function fetchPrice(slug: string, refresh: boolean): Promise<Result> {
  const res = await fetch(`/api/arcanes/${slug}/price${refresh ? "?refresh=1" : ""}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Price lookup failed");
  return json;
}

export function ArcanePrice({ slug, tradable }: { slug: string; tradable: boolean }) {
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(tradable);

  useEffect(() => {
    if (!tradable) return;
    let alive = true;
    fetchPrice(slug, false)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [slug, tradable]);

  function refresh() {
    setLoading(true); setError(null);
    fetchPrice(slug, true).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }

  return (
    <section className="card space-y-4" aria-busy={loading}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="kicker">Current price</h2>
        {tradable && <button className="btn min-h-9 px-3 text-xs" onClick={refresh} disabled={loading}>{loading ? "Loading…" : "↻ Refresh"}</button>}
      </div>
      {!tradable && <p className="text-sm text-dim">Not tradable on Warframe Market.</p>}
      {error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {loading && !data && <div className="h-24 animate-pulse bg-panel-2" />}
      {data && (
        <>
          {data.ranks.length === 0 && <p className="text-sm text-dim">No live sell listings right now.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {data.ranks.map((r) => (
              <div key={r.rank} className="rounded-lg border border-line bg-void/40 p-3">
                <div className="text-xs uppercase tracking-wider text-dim">{r.label}</div>
                {r.low != null ? (
                  <div className="h-display flex items-baseline gap-2 text-3xl text-plat">{r.low}<Plat size={20} className="self-center" /> <span className="font-sans text-sm normal-case tracking-normal text-dim">low · median {r.median}</span></div>
                ) : <div className="text-dim">—</div>}
                <div className="mt-0.5 text-xs text-dim">{r.onlineListings} online of {r.totalListings} listed{r.basis === "offline" && " — no one online, offline sellers shown"}</div>
                <ul className="mt-2 space-y-1">
                  {r.listings.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className={`inline-block size-2 shrink-0 rounded-full ${dot[l.status] ?? "bg-dim/50"}`} />
                        <a className="truncate text-teal hover:underline" href={l.sellerUrl} target="_blank" rel="noopener noreferrer">{l.seller}</a>
                        <span className="shrink-0 text-xs text-dim">{timeAgo(l.updatedAt)}</span>
                      </span>
                      <span className="flex items-center gap-1 font-mono text-plat">{l.price}<Plat size={12} />{l.quantity > 1 && <span className="text-xs text-dim"> ×{l.quantity}</span>}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-xs text-dim">
            Cheapest live sell orders (online sellers). <a className="text-teal hover:underline" href={data.itemUrl} target="_blank" rel="noopener noreferrer">Open on Warframe Market ↗</a> · fetched {timeAgo(data.fetchedAt)}{data.fromCache ? " (cached ≤12 min)" : ""}{data.stale ? " · older data: Warframe Market didn’t respond" : ""}
          </p>
        </>
      )}
    </section>
  );
}
