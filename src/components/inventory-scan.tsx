"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plat } from "@/components/brand";
import { ListOnMarket } from "@/components/list-on-market";
import { READ_EDGE, ScanImage } from "@/lib/image-prep";
import { ducatVerdict } from "@/lib/primes/ducats";
import { mergeScans, valueScan, type MatchedItem, type ReadItem, type ScanMatch } from "@/lib/primes/scan-match";

export interface PartInfo { name: string; price: number | null; ducats: number | null }
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const MAX_IMAGES = 12;

interface Shot { id: number; label: string; state: "queued" | "reading" | "done" | "error"; msg?: string; result?: ScanMatch }

/** Attach screenshots of your Prime inventory; it reads the parts, values them, and lists them most expensive first. */
export function InventoryScan({ info, signedIn }: { info: Record<string, PartInfo>; signedIn: boolean }) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [edits, setEdits] = useState<Record<string, number | null | undefined>>({}); // slug -> corrected qty (null = removed)
  const [added, setAdded] = useState<Record<string, number>>({}); // parts the user added by hand
  const [pick, setPick] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [listing, setListing] = useState(false);
  const nextId = useRef(1);
  const input = useRef<HTMLInputElement>(null);

  const names = useMemo(() => new Map(Object.entries(info).map(([slug, p]) => [p.name.toLowerCase(), slug])), [info]);

  const merged = useMemo(() => mergeScans(shots.flatMap((s) => (s.result ? [s.result] : []))), [shots]);
  const items: MatchedItem[] = useMemo(() => {
    const m = new Map<string, MatchedItem>();
    for (const i of merged.matched) m.set(i.slug, i);
    for (const [slug, qty] of Object.entries(added)) m.set(slug, { slug, name: info[slug]?.name ?? slug, qty: Math.max(m.get(slug)?.qty ?? 0, qty), readAs: null });
    return [...m.values()].flatMap((i) => { const e = edits[i.slug]; return e === null ? [] : [{ ...i, qty: e ?? i.qty }]; });
  }, [merged, added, edits, info]);
  const value = useMemo(() => valueScan(items, (s) => info[s]?.price ?? null, (s) => info[s]?.ducats ?? null), [items, info]);
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
    setAdded((a) => ({ ...a, [slug]: (a[slug] ?? 0) + 1 }));
    setEdits((e) => ({ ...e, [slug]: undefined }));
    setPick("");
  }

  async function save() {
    setSaving(true); setSaveMsg(null);
    let ok = 0;
    for (const r of value.rows) {
      const res = await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "prime", slug: r.slug, rank: 0, qty: r.qty }) });
      if (res.ok) ok++;
    }
    setSaving(false);
    setSaveMsg(`Added ${ok} of ${value.rows.length} items to your inventory.`);
  }

  const unmatched: ReadItem[] = merged.unmatched;

  function clearAll() {
    if (!confirm("Clear everything on this page — the screenshots, the parts read from them and any you added by hand? (Your saved inventory isn’t touched.)")) return;
    setShots([]); setEdits({}); setAdded({}); setPick(""); setSaveMsg(null); setListing(false);
  }
  const hasAnything = shots.length > 0 || Object.keys(added).length > 0;

  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <div>
          <p className="kicker">Prime parts worth</p>
          <p className="h-display flex items-center gap-2 text-4xl text-plat">{value.priced ? <>≈ {fmt(value.total)} <Plat size={26} /></> : <span className="text-dim">—</span>}</p>
          <p className="mt-1 text-xs text-dim">{value.priced} of {value.rows.length} items priced · average of the 5 cheapest online listings, × how many you have</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            {signedIn && value.rows.length > 0 && <button className="btn-primary" onClick={() => setListing(true)} disabled={busy}>List on Warframe Market</button>}
            {signedIn && value.rows.length > 0 && <button className="btn" onClick={save} disabled={saving || busy}>{saving ? "Saving…" : "Add all to my inventory"}</button>}
            {hasAnything && <button className="btn-danger" onClick={clearAll}>Clear all</button>}
          </div>
          {saveMsg && <p className="text-xs text-dim">{saveMsg} <Link href="/market/inventory" className="text-gold underline">Open inventory</Link></p>}
          {!signedIn && value.rows.length > 0 && <p className="text-xs text-dim"><Link href="/login?next=/primes/scan" className="text-gold underline">Sign in</Link> to list these on Warframe Market or save them.</p>}
        </div>
      </section>

      {listing && signedIn && <ListOnMarket rows={value.rows.map((r) => ({ slug: r.slug, name: r.name, qty: r.qty, unit: r.unit, ducats: r.ducats }))} onClose={() => setListing(false)} />}

      {plan.ducatParts > 0 && (
        <section className="card text-sm text-dim">
          <p><span className="font-semibold text-ink">Plan:</span> sell the rest for <span className="text-plat">≈ {fmt(plan.sellPlat)}p</span>, and take <span className="font-semibold text-violet">{plan.ducatParts} cheap parts to Baro for {plan.ducats} ducats</span> — they’re worth more as ducats (10+ ducats per platinum) than as platinum.</p>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="kicker">Your screenshots</h2>
        <div
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-void/40 p-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void attach(e.dataTransfer.files); }}
        >
          <p className="text-sm text-ink">Drop screenshots of your Prime parts here</p>
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
                  {s.state === "queued" ? "Waiting…" : s.state === "reading" ? "Reading…" : s.state === "error" ? s.msg : `${s.result?.matched.length ?? 0} parts read`}
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
            <h2 className="kicker">Most expensive first</h2>
            <p className="text-xs text-dim">Check the counts — fix any it misread.</p>
          </div>
          <ul className="divide-y divide-line">
            {value.rows.map((r) => (
              <li key={r.slug} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-ink">{r.name}</p>
                  <p className="text-xs text-dim">
                    {r.unit != null ? <><span className="text-plat">{fmt(r.unit)}p</span> each</> : "no price yet"}
                    {r.ducats != null && <> · {r.ducats} ducats</>}
                    {ducatVerdict(r.unit, r.ducats) === "ducat" && <> · <span className="font-semibold text-violet">ducat it</span></>}
                    {r.readAs && <> · read as “{r.readAs}”</>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="sr-only" htmlFor={`q-${r.slug}`}>Quantity of {r.name}</label>
                  <input id={`q-${r.slug}`} className="input w-16 text-center" type="number" min={1} max={9999} value={r.qty}
                    onChange={(e) => setEdits((x) => ({ ...x, [r.slug]: Math.max(1, Number(e.target.value) || 1) }))} />
                  <span className="w-20 text-right text-sm text-plat">{r.total != null ? <>{fmt(r.total)} <Plat size={12} /></> : <span className="text-dim">—</span>}</span>
                  <button className="text-xs text-dim underline" onClick={() => setEdits((x) => ({ ...x, [r.slug]: null }))} aria-label={`Remove ${r.name}`}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {unmatched.length > 0 && (
        <section className="card space-y-2 text-sm">
          <h2 className="kicker">Couldn’t match these</h2>
          <p className="text-xs text-dim">These were read from your screenshots but don’t clearly match a tradable Prime part (or could be two). Add the right one below.</p>
          <ul className="flex flex-wrap gap-2">{unmatched.map((u) => <li key={u.name} className="rounded-lg border border-line px-2 py-1 text-xs text-dim">{u.name} ×{u.qty}</li>)}</ul>
        </section>
      )}

      <section className="card space-y-2">
        <h2 className="kicker">Add a part by hand</h2>
        <div className="flex gap-2">
          <input className="input flex-1" list="scan-options" value={pick} onChange={(e) => setPick(e.target.value)} placeholder="e.g. Frost Prime Chassis Blueprint" autoComplete="off" aria-label="Prime part" />
          <datalist id="scan-options">{Object.values(info).map((p) => <option key={p.name} value={p.name} />)}</datalist>
          <button className="btn" onClick={addByHand} disabled={!names.has(pick.trim().toLowerCase())}>Add</button>
        </div>
      </section>
    </div>
  );
}
