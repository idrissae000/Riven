"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plat } from "@/components/brand";
import { Segmented } from "@/components/segmented";
import { ListOnMarket, sellKey } from "@/components/list-on-market";
import { READ_EDGE, ScanImage } from "@/lib/image-prep";
import { InventoryFilter } from "@/components/inventory-filter";
import { browseRows, type InvSort } from "@/lib/inventory/browse";
import type { SetDef } from "@/lib/primes/combine-sets";
import { ducatVerdict } from "@/lib/primes/ducats";
import { mergeScans, valueScan, type MatchedItem, type ReadItem, type ScanMatch } from "@/lib/primes/scan-match";

export interface PartInfo {
  name: string; price: number | null; ducats: number | null;
  /** Arcanes: the max rank, and the price at max rank (`price` is the unranked price). */
  maxRank?: number | null; priceMax?: number | null;
}
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const MAX_IMAGES = 12;

interface Shot { id: number; label: string; state: "queued" | "reading" | "done" | "error"; msg?: string; result?: ScanMatch }

const keyOf = (slug: string, rank: number) => `${slug}:${rank}`;

/** Attach screenshots of your Prime parts or arcanes (inventory or mission rewards); it reads them, values them, and lists them most expensive first. */
export function InventoryScan({ kind = "prime", info, signedIn, sets, setPrices }: { kind?: "prime" | "arcane"; info: Record<string, PartInfo>; signedIn: boolean; sets: SetDef[]; setPrices: Record<string, number> }) {
  const arcane = kind === "arcane";
  const noun = arcane ? "arcanes" : "parts";
  const [shots, setShots] = useState<Shot[]>([]);
  const [edits, setEdits] = useState<Record<string, number | null | undefined>>({}); // "slug:rank" -> corrected qty (null = removed)
  const [added, setAdded] = useState<Record<string, number>>({}); // "slug:0" -> items the user added by hand
  const [rankOverride, setRankOverride] = useState<Record<string, number>>({}); // original "slug:rank" -> rank the user chose
  const [pick, setPick] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [listing, setListing] = useState(false);
  const [mode, setMode] = useState<"inventory" | "rewards">("inventory");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<InvSort>("price");
  const nextId = useRef(1);
  const input = useRef<HTMLInputElement>(null);

  const names = useMemo(() => new Map(Object.entries(info).map(([slug, p]) => [p.name.toLowerCase(), slug])), [info]);

  const merged = useMemo(() => mergeScans(shots.flatMap((s) => (s.result ? [s.result] : [])), mode === "rewards" ? "sum" : "max"), [shots, mode]);
  const { items, srcOf } = useMemo(() => {
    const base = new Map<string, MatchedItem>();
    for (const i of merged.matched) base.set(keyOf(i.slug, i.rank), i);
    for (const [k, qty] of Object.entries(added)) {
      const slug = k.split(":")[0];
      base.set(k, { slug, name: info[slug]?.name ?? slug, qty: Math.max(base.get(k)?.qty ?? 0, qty), readAs: null, rank: 0 });
    }
    const out = new Map<string, MatchedItem>();
    const src = new Map<string, string[]>();
    for (const [origKey, b] of base) {
      const rank = rankOverride[origKey] ?? b.rank;
      const key = keyOf(b.slug, rank);
      const have = out.get(key);
      if (have) have.qty = Math.min(9999, have.qty + b.qty); else out.set(key, { ...b, rank });
      src.set(key, [...(src.get(key) ?? []), origKey]);
    }
    const list = [...out.entries()].flatMap(([key, i]) => { const e = edits[key]; return e === null ? [] : [{ ...i, qty: e ?? i.qty }]; });
    return { items: list, srcOf: src };
  }, [merged, added, edits, rankOverride, info]);
  const value = useMemo(() => valueScan(items, (slug, rank) => (rank > 0 ? info[slug]?.priceMax : info[slug]?.price) ?? null, (slug) => (arcane ? null : info[slug]?.ducats ?? null)), [items, info, arcane]);
  const plan = useMemo(() => {
    let ducatParts = 0, ducats = 0, sellPlat = 0;
    for (const r of value.rows) {
      if (ducatVerdict(r.unit, r.ducats) === "ducat") { ducatParts += r.qty; ducats += r.qty * (r.ducats ?? 0); }
      else if (r.total != null) sellPlat += r.total;
    }
    return { ducatParts, ducats, sellPlat: Math.round(sellPlat * 10) / 10 };
  }, [value]);
  const busy = shots.some((s) => s.state === "reading" || s.state === "queued");

  async function readOne(id: number, file: File) {
    const patch = (p: Partial<Shot>) => setShots((all) => all.map((s) => (s.id === id ? { ...s, ...p } : s)));
    patch({ state: "reading" });
    let img: ScanImage | null = null;
    try {
      img = await ScanImage.open(file);
      const upload = img.isSmallPng ? file : await img.jpeg({ maxEdge: READ_EDGE });
      const body = new FormData();
      body.append("image", upload);
      body.append("mode", mode);
      body.append("kind", kind);
      const res = await fetch("/api/primes/scan", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return patch({ state: "error", msg: json.error ?? (res.status === 413 ? "That image is too large." : "The scan didn’t work.") });
      patch({ state: "done", result: { matched: json.matched ?? [], unmatched: json.unmatched ?? [] } satisfies ScanMatch, msg: json.notes || undefined });
    } catch (e) {
      patch({ state: "error", msg: e instanceof Error ? e.message : "Couldn’t read that image." });
    } finally {
      img?.close();
    }
  }

  async function attach(files: FileList | File[]) {
    const imgs = [...files].filter((f) => f.type.startsWith("image/")).slice(0, MAX_IMAGES - shots.length);
    const fresh = imgs.map((f) => ({ id: nextId.current++, label: f.name || "screenshot", state: "queued" as const, f }));
    if (!fresh.length) return;
    setShots((s) => [...s, ...fresh.map((f) => ({ id: f.id, label: f.label, state: f.state }))]);
    for (const f of fresh) await readOne(f.id, f.f); // one at a time: kind to the rate limit
  }

  function addByHand() {
    const slug = names.get(pick.trim().toLowerCase());
    if (!slug) return;
    const k = keyOf(slug, 0);
    setAdded((a) => ({ ...a, [k]: (a[k] ?? 0) + 1 }));
    setEdits((e) => ({ ...e, [k]: undefined }));
    setPick("");
  }

  async function save() {
    setSaving(true); setSaveMsg(null);
    let ok = 0;
    for (const r of value.rows) {
      const res = await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, slug: r.slug, rank: r.rank, qty: r.qty }) });
      if (res.ok) ok++;
    }
    setSaving(false);
    setSaveMsg(`Added ${ok} of ${value.rows.length} items to your inventory.`);
    // a rewards run is finished once it's saved: reset so the next run's screenshots start clean (nothing to double-add)
    if (mode === "rewards" && ok === value.rows.length) { setShots([]); setEdits({}); setAdded({}); setRankOverride({}); setQ(""); }
  }

  const unmatched: ReadItem[] = merged.unmatched;
  const shownRows = useMemo(() => browseRows(value.rows.map((r) => ({ ...r })), q, sort), [value.rows, q, sort]);

  function clearAll() {
    if (!confirm(`Clear everything on this page — the screenshots, the ${noun} read from them and any you added by hand? (Your saved inventory isn’t touched.)`)) return;
    setShots([]); setEdits({}); setAdded({}); setRankOverride({}); setPick(""); setSaveMsg(null); setListing(false);
  }
  const hasAnything = shots.length > 0 || Object.keys(added).length > 0;

  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <div>
          <p className="kicker">{arcane ? "Arcanes worth" : "Prime parts worth"}</p>
          <p className="h-display flex items-center gap-2 text-4xl text-plat">{value.priced ? <>≈ {fmt(value.total)} <Plat size={26} /></> : <span className="text-dim">—</span>}</p>
          <p className="mt-1 text-xs text-dim">{value.priced} of {value.rows.length} items priced · average of the 5 cheapest online listings, × how many you have</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            {signedIn && value.rows.length > 0 && <button className="btn-primary" onClick={() => setListing(true)} disabled={busy}>List on Warframe Market</button>}
            {signedIn && value.rows.length > 0 && <button className="btn" onClick={save} disabled={saving || busy}>{saving ? "Saving…" : mode === "rewards" ? "Add these to my inventory" : "Add all to my inventory"}</button>}
            {hasAnything && <button className="btn-danger" onClick={clearAll}>Clear all</button>}
          </div>
          {saveMsg && <p className="text-xs text-dim">{saveMsg} <Link href="/inventory" className="text-gold underline">Open inventory</Link></p>}
          {!signedIn && value.rows.length > 0 && <p className="text-xs text-dim"><Link href="/login?next=/inventory/scan" className="text-gold underline">Sign in</Link> to list these on Warframe Market or save them.</p>}
        </div>
      </section>

      {listing && signedIn && <ListOnMarket sets={arcane ? [] : sets} setPrices={setPrices} rows={value.rows.map((r) => ({ key: sellKey(kind, r.slug, r.rank), kind, slug: r.slug, rank: r.rank, name: r.rank > 0 ? `${r.name} (max rank)` : r.name, qty: r.qty, unit: r.unit, ducats: r.ducats }))} onClose={() => setListing(false)} />}

      {!arcane && plan.ducatParts > 0 && (
        <section className="card text-sm text-dim">
          <p><span className="font-semibold text-ink">Plan:</span> sell the rest for <span className="text-plat">≈ {fmt(plan.sellPlat)}p</span>, and take <span className="font-semibold text-violet">{plan.ducatParts} cheap parts to Baro for {plan.ducats} ducats</span> — they’re worth more as ducats (10+ ducats per platinum) than as platinum.</p>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="kicker">Your screenshots</h2>
        <div className="space-y-1.5">
          <Segmented<"inventory" | "rewards"> label="What are the screenshots of?" value={mode} onChange={(m) => { if (!shots.length) setMode(m); }} options={[{ value: "inventory", label: "My inventory" }, { value: "rewards", label: "Mission rewards" }]} />
          <p className="text-xs text-dim">
            {mode === "inventory" ? arcane ? "Screenshots of your arcanes. Overlapping screenshots are fine — the same arcane at the same rank in two of them is counted once." : "Screenshots of your Prime parts list. Overlapping screenshots are fine — an item in two of them is counted once." : `Screenshots of a reward screen${arcane ? " that shows arcanes" : " (Void Cascade, fissures…)"}. Each screenshot is new loot, so they’re added up; save them to your inventory when you’re done.`}
            {shots.length > 0 && " Clear all to switch."}
          </p>
        </div>
        <div
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-void/40 p-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void attach(e.dataTransfer.files); }}
        >
          <p className="text-sm text-ink">{mode === "rewards" ? "Drop your reward screenshots here" : `Drop screenshots of your ${arcane ? "arcanes" : "Prime parts"} here`}</p>
          <p className="text-xs text-dim">Add as many as it takes to cover the whole list (up to {MAX_IMAGES}). Overlaps are fine — an item that shows up in two screenshots is counted once.</p>
          <button className="btn-primary" onClick={() => input.current?.click()} disabled={shots.length >= MAX_IMAGES}>Choose images</button>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { if (e.target.files) void attach(e.target.files); e.target.value = ""; }} />
        </div>
        {shots.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {shots.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-void/40 px-3 py-2">
                <span className="min-w-0 truncate text-dim">{s.label}</span>
                <span className={`shrink-0 text-xs ${s.state === "error" ? "text-danger" : s.state === "done" ? "text-teal" : "text-dim"}`}>
                  {s.state === "queued" ? "Waiting…" : s.state === "reading" ? "Reading…" : s.state === "error" ? s.msg : `${s.result?.matched.length ?? 0} ${noun} read`}
                </span>
                {s.state !== "reading" && <button className="shrink-0 text-xs text-dim underline" onClick={() => setShots((all) => all.filter((x) => x.id !== s.id))}>Remove</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {value.rows.length > 0 && (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="kicker">Your {noun}</h2>
            <p className="text-xs text-dim">Check the counts — fix any it misread.</p>
          </div>
          <InventoryFilter q={q} onQ={setQ} sort={sort} onSort={setSort} shown={shownRows.length} total={value.rows.length} />
          <ul className="divide-y divide-line">
            {shownRows.map((r) => (
              <li key={keyOf(r.slug, r.rank)} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-ink">{r.name}{r.rank > 0 && <span className="ml-2 text-xs text-dim">max rank</span>}</p>
                  <p className="text-xs text-dim">
                    {r.unit != null ? <><span className="text-plat">{fmt(r.unit)}p</span> each</> : "no price yet"}
                    {r.ducats != null && <> · {r.ducats} ducats</>}
                    {ducatVerdict(r.unit, r.ducats) === "ducat" && <> · <span className="font-semibold text-violet">ducat it</span></>}
                    {r.readAs && <> · read as “{r.readAs}”</>}
                    {r.seenRank != null && <> · <span className="text-orange">showed rank {r.seenRank} — counted as unranked</span></>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {arcane && info[r.slug]?.maxRank != null && (
                    <select className="input w-32 text-xs" aria-label={`Rank of ${r.name}`} value={r.rank}
                      onChange={(e) => { const next = Number(e.target.value); setRankOverride((o) => ({ ...o, ...Object.fromEntries((srcOf.get(keyOf(r.slug, r.rank)) ?? []).map((k) => [k, next])) })); }}>
                      <option value={0}>Unranked</option><option value={info[r.slug].maxRank as number}>Max rank ({info[r.slug].maxRank})</option>
                    </select>
                  )}
                  <label className="sr-only" htmlFor={`q-${keyOf(r.slug, r.rank)}`}>Quantity of {r.name}</label>
                  <input id={`q-${keyOf(r.slug, r.rank)}`} className="input w-16 text-center" type="number" min={1} max={9999} value={r.qty}
                    onChange={(e) => setEdits((x) => ({ ...x, [keyOf(r.slug, r.rank)]: Math.max(1, Number(e.target.value) || 1) }))} />
                  <span className="w-20 text-right text-sm text-plat">{r.total != null ? <>{fmt(r.total)} <Plat size={12} /></> : <span className="text-dim">—</span>}</span>
                  <button className="text-xs text-dim underline" onClick={() => setEdits((x) => ({ ...x, [keyOf(r.slug, r.rank)]: null }))} aria-label={`Remove ${r.name}`}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {unmatched.length > 0 && (
        <section className="card space-y-2 text-sm">
          <h2 className="kicker">Couldn’t match these</h2>
          <p className="text-xs text-dim">These were read from your screenshots but don’t clearly match a tradable {arcane ? "arcane" : "Prime part"} (or could be two). Add the right one below.</p>
          <ul className="flex flex-wrap gap-2">{unmatched.map((u) => <li key={u.name} className="rounded-lg border border-line px-2 py-1 text-xs text-dim">{u.name} ×{u.qty}</li>)}</ul>
        </section>
      )}

      <section className="card space-y-2">
        <h2 className="kicker">Add {arcane ? "an arcane" : "a part"} by hand</h2>
        <div className="flex gap-2">
          <input className="input flex-1" list={`scan-options-${kind}`} value={pick} onChange={(e) => setPick(e.target.value)} placeholder={arcane ? "e.g. Arcane Energize" : "e.g. Frost Prime Chassis Blueprint"} autoComplete="off" aria-label={arcane ? "Arcane" : "Prime part"} />
          <datalist id={`scan-options-${kind}`}>{Object.values(info).map((p) => <option key={p.name} value={p.name} />)}</datalist>
          <button className="btn" onClick={addByHand} disabled={!names.has(pick.trim().toLowerCase())}>Add</button>
        </div>
      </section>
    </div>
  );
}
