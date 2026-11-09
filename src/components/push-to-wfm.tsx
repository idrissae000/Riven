"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WfmConnect, useWfmStatus } from "@/components/wfm-connect";

interface Props {
  rivenId: string;
  label: string; // e.g. "Soma Crita-cron"
  hasName: boolean;
  listed: { auctionId: string; price: number | null } | null;
}

export function PushToWfm({ rivenId, label, hasName, listed }: Props) {
  const router = useRouter();
  const { status, refresh } = useWfmStatus();
  const [price, setPrice] = useState("");
  const [picks, setPicks] = useState<{ low: number; median: number; high: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Prefill the price from the (server-cached) market estimate.
  useEffect(() => {
    if (listed) return;
    let alive = true;
    fetch(`/api/rivens/${rivenId}/market`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j?.estimate || !j.listings?.length) return;
        setPicks({ low: j.estimate.low, median: j.estimate.median, high: j.estimate.high });
        setPrice((p) => p || String(j.estimate.median));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [rivenId, listed]);

  async function push() {
    const n = Number(price);
    if (!Number.isInteger(n) || n < 1) return setMsg({ kind: "err", text: "Enter a whole-number price." });
    if (!confirm(`List ${label} on Warframe Market for ${n} platinum?`)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/rivens/${rivenId}/push`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ price: n }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { router.refresh(); return; }
    if (json.reauth) refresh();
    setMsg({ kind: "err", text: json.error ?? "Could not list the riven." });
  }

  async function remove() {
    if (!confirm("Remove this listing from Warframe Market?")) return;
    setBusy(true);
    const res = await fetch(`/api/rivens/${rivenId}/push`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) return router.refresh();
    if (json.reauth) refresh();
    setMsg({ kind: "err", text: json.error ?? "Could not remove the listing." });
  }

  return (
    <section className="card space-y-3">
      <h2 className="h-display text-xl text-violet">Warframe Market listing</h2>

      {listed ? (
        <div className="space-y-3">
          <p className="text-sm">
            <span className="mr-2 inline-block size-2 rounded-full bg-ok" />
            Listed{listed.price ? <> for <strong className="text-orange">{listed.price}p</strong></> : null}.{" "}
            <a className="text-teal hover:underline" href={`https://warframe.market/auction/${listed.auctionId}`} target="_blank" rel="noopener noreferrer">View listing ↗</a>
          </p>
          <button className="btn-danger" onClick={remove} disabled={busy}>Remove listing</button>
        </div>
      ) : !hasName ? (
        <p className="text-sm text-dim">Add this riven’s name (e.g. “Crita-cron”) by editing it — Warframe Market requires it to list.</p>
      ) : status?.connected ? (
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label" htmlFor="push-price">Price (platinum)</label>
              <input id="push-price" className="input font-mono" inputMode="numeric" type="number" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 450" />
            </div>
            <button className="btn-primary" onClick={push} disabled={busy || !price}>{busy ? "Listing…" : "List on WFM"}</button>
          </div>
          {picks && (
            <div className="flex flex-wrap gap-2 text-xs">
              {(["low", "median", "high"] as const).map((k) => (
                <button key={k} type="button" className="chip hover:border-teal/60 hover:text-teal" onClick={() => setPrice(String(picks[k]))}>{k} {picks[k]}p</button>
              ))}
            </div>
          )}
          <WfmConnect status={status} onChange={refresh} />
        </div>
      ) : (
        <WfmConnect status={status} onChange={refresh} />
      )}

      {msg && <p role="alert" className={`text-sm ${msg.kind === "ok" ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
    </section>
  );
}
