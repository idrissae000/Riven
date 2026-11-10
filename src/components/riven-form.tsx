"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Polarity, Riven, RivenAttribute, Weapon } from "@/lib/types";
import { POLARITIES } from "@/lib/types";
import { unitSuffix } from "@/lib/format";
import { signPrefix, toStoredValue, toTypedValue } from "@/lib/stat-sign";
import type { MappedScan } from "@/lib/ocr/map";
import { encodeRiven } from "@/lib/riven-share";
import { CROP_ABOVE, OVERVIEW_EDGE, READ_EDGE, ScanImage, padBox, type Box } from "@/lib/image-prep";
import type { RivenInput } from "@/lib/riven-schema";

interface Row { stat: string; value: string }

export interface RivenFormInitial {
  weapon_slug?: string; riven_name?: string | null; polarity?: Polarity; mastery_rank?: number;
  rank?: number; rerolls?: number; notes?: string | null; stats?: Riven["stats"];
}

const emptyRow = (): Row => ({ stat: "", value: "" });

function toRows(initial: RivenFormInitial | undefined, attrs: Map<string, RivenAttribute>) {
  const stats = initial?.stats ?? [];
  const typed = (s: Riven["stats"][number]) => String(toTypedValue(attrs.get(s.stat), s.value));
  const pos = stats.filter((s) => !s.is_negative).map((s) => ({ stat: s.stat, value: typed(s) }));
  const neg = stats.find((s) => s.is_negative);
  while (pos.length < 2) pos.push(emptyRow());
  return { pos, neg: neg ? { stat: neg.stat, value: typed(neg) } : emptyRow(), hasNeg: !!neg };
}

function StatRow({ row, onChange, negative, onRemove, options, unit, prefix }: {
  row: Row; onChange: (r: Row) => void; negative: boolean; onRemove?: () => void;
  options: RivenAttribute[]; unit: string; prefix: string;
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <select className="input" value={row.stat} onChange={(e) => onChange({ ...row, stat: e.target.value })} aria-label={negative ? "Negative stat" : "Stat"}>
          <option value="">Select stat…</option>
          {options.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
        </select>
      </div>
      <div className="relative w-32 shrink-0">
        <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono ${negative ? "text-danger" : "text-ok"}`}>{prefix}</span>
        <input className="input pl-7 pr-7 font-mono" inputMode="decimal" type="number" step="any" min="0" placeholder="0.0"
          value={row.value} onChange={(e) => onChange({ ...row, value: e.target.value })} aria-label="Value" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-dim">{unit}</span>
      </div>
      {onRemove && <button type="button" className="btn px-3" onClick={onRemove} aria-label="Remove stat">✕</button>}
    </div>
  );
}

export function RivenForm({
  weapons, attributes, initial, rivenId, signedIn = true,
}: { weapons: Weapon[]; attributes: RivenAttribute[]; initial?: RivenFormInitial; rivenId?: string; signedIn?: boolean }) {
  const router = useRouter();
  const attrBySlug = useMemo(() => new Map(attributes.map((a) => [a.slug, a])), [attributes]);
  const init = useMemo(() => toRows(initial, attrBySlug), [initial, attrBySlug]);
  const [weaponText, setWeaponText] = useState(weapons.find((w) => w.slug === initial?.weapon_slug)?.name ?? "");
  const [rivenName, setRivenName] = useState(initial?.riven_name ?? "");
  const [polarity, setPolarity] = useState<Polarity>(initial?.polarity ?? "madurai");
  const [mr, setMr] = useState(String(initial?.mastery_rank ?? 8));
  const [rank, setRank] = useState(String(initial?.rank ?? 0));
  const [rerolls, setRerolls] = useState(String(initial?.rerolls ?? 0));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pos, setPos] = useState<Row[]>(init.pos);
  const [hasNeg, setHasNeg] = useState(init.hasNeg);
  const [neg, setNeg] = useState<Row>(init.neg);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weapon = weapons.find((w) => w.name.toLowerCase() === weaponText.trim().toLowerCase());
  const usable = (a: RivenAttribute) =>
    !weapon || !a.exclusive_to || a.exclusive_to.length === 0 || a.exclusive_to.includes(weapon.riven_type);

  const used = new Set([...pos.map((r) => r.stat), hasNeg ? neg.stat : ""].filter(Boolean));
  const optionsFor = (current: string, negative: boolean) =>
    attributes.filter((a) => usable(a) && (!negative || !a.positive_only) && (a.slug === current || !used.has(a.slug)));

  const [dragOver, setDragOver] = useState(false);
  const [readLog, setReadLog] = useState<{ weapon: string | null; weaponOk: boolean; riven: string | null; rank: number | null; stats: { read: string; as: string | null; curse: boolean }[] } | null>(null);
  const [scanState, setScanState] = useState<{ busy: boolean; msg: string | null; kind: "ok" | "err" }>({ busy: false, msg: null, kind: "ok" });

  // Ctrl/⌘+V anywhere on the page: if the clipboard holds an image, scan it.
  useEffect(() => {
    if (rivenId) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) { e.preventDefault(); void scan(file); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scan is recreated each render; it only reads state setters + props
  }, [rivenId, weapons]);

  /** Prefills the form from a screenshot. Nothing is saved: the user reviews, fixes and saves as usual. */
  async function locateCard(overview: File): Promise<Box | null> {
    try {
      const body = new FormData();
      body.append("image", overview);
      const res = await fetch("/api/rivens/scan?stage=locate", { method: "POST", body });
      return res.ok ? ((await res.json()).box as Box | null) ?? null : null; // any problem => just read the whole image
    } catch {
      return null;
    }
  }

  async function scan(file: File) {
    setReadLog(null);
    setScanState({ busy: true, msg: "Preparing your image…", kind: "ok" });
    const body = new FormData();
    let img: ScanImage | null = null;
    try {
      img = await ScanImage.open(file);
      let upload: File;
      if (img.longEdge > CROP_ABOVE) {
        // Big screenshot/photo: the card is a small part of it. Find it, then read it from the ORIGINAL pixels.
        setScanState({ busy: true, msg: "Finding the riven card…", kind: "ok" });
        const box = await locateCard(await img.jpeg({ maxEdge: OVERVIEW_EDGE }));
        upload = await img.jpeg({ maxEdge: READ_EDGE, crop: box ? padBox(box) : undefined });
      } else {
        upload = img.isSmallPng ? file : await img.jpeg({ maxEdge: READ_EDGE });
      }
      body.append("image", upload);
    } catch (e) {
      return setScanState({ busy: false, msg: e instanceof Error ? e.message : "Couldn’t read that image.", kind: "err" });
    } finally {
      img?.close();
    }
    setScanState({ busy: true, msg: "Reading the riven…", kind: "ok" });
    let res: Response;
    try {
      res = await fetch("/api/rivens/scan", { method: "POST", body });
    } catch {
      return setScanState({ busy: false, msg: "Couldn’t reach the server — check your connection and try again.", kind: "err" });
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const tooBig = res.status === 413;
      return setScanState({ busy: false, msg: json.error ?? (tooBig ? "That image is too large — crop it closer to the card." : "The scan didn’t work. You can still enter the stats by hand below."), kind: "err" });
    }
    const r = json as MappedScan;
    setReadLog({ weapon: r.weapon_name, weaponOk: !!r.weapon_slug, riven: r.riven_name, rank: r.rank, stats: r.stats.map((st) => ({ read: `${st.scanned.shown} ${st.scanned.name}`, as: st.attribute?.name ?? null, curse: st.is_negative })) });
    const w = weapons.find((x) => x.slug === r.weapon_slug);
    if (w) setWeaponText(w.name); else if (r.weapon_name) setWeaponText(r.weapon_name);
    if (r.riven_name) setRivenName(r.riven_name);
    if (r.polarity) setPolarity(r.polarity);
    if (r.mastery_rank != null) setMr(String(r.mastery_rank));
    if (r.rank != null) setRank(String(r.rank));
    if (r.rerolls != null) setRerolls(String(r.rerolls));
    const toRow = (st: MappedScan["stats"][number]): Row => ({ stat: st.stat ?? "", value: st.value != null ? String(Math.round(st.value * 1000) / 1000) : "" });
    const bonus = r.stats.filter((st) => !st.is_negative).slice(0, 3).map(toRow);
    while (bonus.length < 2) bonus.push(emptyRow());
    setPos(bonus);
    const curse = r.stats.find((st) => st.is_negative);
    setHasNeg(!!curse);
    setNeg(curse ? toRow(curse) : emptyRow());
    const unmatched = r.stats.filter((st) => !st.stat).map((st) => st.scanned.name);
    const problems = [!w && "weapon", unmatched.length && `stat${unmatched.length > 1 ? "s" : ""} “${unmatched.join("”, “")}”`].filter(Boolean);
    setScanState({
      busy: false, kind: problems.length ? "err" : "ok",
      msg: (problems.length ? `Couldn’t match ${problems.join(" and ")} — pick ${problems.length > 1 ? "them" : "it"} below. ` : "Filled in from your image. ") + "Please check every value before saving." + (r.notes ? ` Note: ${r.notes}` : ""),
    });
  }

  async function submit(e: React.FormEvent, checkOnly = !signedIn && !rivenId) {
    e.preventDefault();
    setError(null);
    if (!weapon) return setError("Pick a weapon from the list.");
    const stats = [
      ...pos.filter((r) => r.stat).map((r) => ({ stat: r.stat, value: toStoredValue(attrBySlug.get(r.stat), false, parseFloat(r.value)), is_negative: false })),
      ...(hasNeg && neg.stat ? [{ stat: neg.stat, value: toStoredValue(attrBySlug.get(neg.stat), true, parseFloat(neg.value)), is_negative: true }] : []),
    ];
    if (stats.some((s) => !Number.isFinite(s.value))) return setError("Enter a number for every stat.");
    if (hasNeg && !neg.stat) return setError("Pick the negative stat or untick “has negative”.");
    const body = {
      weapon_slug: weapon.slug, riven_name: rivenName || null, polarity,
      mastery_rank: Number(mr), rank: Number(rank), rerolls: Number(rerolls),
      stats, has_negative: hasNeg && !!neg.stat, notes: notes || null,
    };
    if (checkOnly) {
      // Nothing is stored: the riven rides in the URL and the result page grades + prices it.
      router.push(`/rivens/check?r=${encodeRiven(body as RivenInput)}`);
      return;
    }
    setBusy(true);
    const res = await fetch(rivenId ? `/api/rivens/${rivenId}` : "/api/rivens", {
      method: rivenId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(typeof json.error === "string" ? json.error : "Could not save riven.");
    router.push(`/rivens/${json.id ?? rivenId}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {!rivenId && (
        <div
          className={`relative border border-dashed p-4 transition-colors ${dragOver ? "border-gold bg-gold/10" : "border-line-2 bg-panel/60"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) void scan(f); }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gold" aria-hidden="true">
              <path d="M9 4h14l7 7v23H9z" /><path d="M23 4v7h7" /><path d="M14 25l4-5 3 3.5 2.5-3L28 26" /><circle cx="15.5" cy="17" r="1.4" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold uppercase tracking-[0.12em]">{scanState.busy ? "Reading your riven…" : "Skip the typing"}</p>
              <p className="text-xs leading-relaxed text-dim">A screenshot or a photo from your phone both work. Drop it here, paste it (Ctrl/⌘+V) or choose a file. Always double-check the numbers.</p>
            </div>
            <label className={`btn cursor-pointer sm:shrink-0 ${scanState.busy ? "pointer-events-none opacity-50" : ""}`}>
              Choose image
              <input type="file" accept="image/*" className="sr-only" disabled={scanState.busy}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void scan(f); }} />
            </label>
          </div>
          {scanState.msg && <p role="status" className={`mt-3 text-sm ${scanState.kind === "err" ? "text-orange" : scanState.busy ? "text-dim" : "text-ok"}`}>{scanState.msg}</p>}
          {readLog && (
            <details className="mt-3 text-sm" open>
              <summary className="cursor-pointer font-display text-xs font-semibold uppercase tracking-[0.16em] text-gold">What the scan read</summary>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                <li>Weapon: {readLog.weapon ?? "—"} {readLog.weapon && (readLog.weaponOk ? <span className="text-ok">✓</span> : <span className="text-orange">not in the weapon list — pick it below</span>)}{readLog.riven && <span className="text-dim"> · name {readLog.riven}</span>}</li>
                <li>Rank: {readLog.rank != null ? <>{readLog.rank} <span className="text-dim">(top-right number {readLog.rank + 10})</span> <span className="text-ok">✓</span></> : <span className="text-orange">couldn’t read the top-right number — set the rank below</span>}</li>
                {readLog.stats.map((st, i) => (
                  <li key={i} className={st.curse ? "text-danger" : ""}>
                    {st.read} {st.as ? <span className="text-ok">→ {st.as} ✓</span> : <span className="text-orange">→ no match, choose the stat below</span>}{st.curse && <span className="text-dim"> (negative)</span>}
                  </li>
                ))}
                {readLog.stats.length === 0 && <li className="text-orange">No stat lines were found. Try a closer or brighter image.</li>}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="card space-y-4">
        <div>
          <label className="label" htmlFor="weapon">Weapon</label>
          <input id="weapon" className="input" list="weapon-list" placeholder="Start typing… e.g. Soma" value={weaponText} onChange={(e) => setWeaponText(e.target.value)} autoComplete="off" required />
          <datalist id="weapon-list">{weapons.map((w) => <option key={w.slug} value={w.name} />)}</datalist>
          {weapon && <p className="mt-1 text-xs text-dim">{weapon.riven_type} · disposition {weapon.disposition ?? "?"}</p>}
        </div>
        <div>
          <label className="label" htmlFor="rname">Riven name <span className="normal-case text-dim/70">(optional, e.g. Acria-da)</span></label>
          <input id="rname" className="input" value={rivenName} onChange={(e) => setRivenName(e.target.value)} maxLength={40} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="pol">Polarity</label>
            <select id="pol" className="input" value={polarity} onChange={(e) => setPolarity(e.target.value as Polarity)}>
              {POLARITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="mr">MR req</label>
            <input id="mr" className="input" type="number" min={8} max={16} value={mr} onChange={(e) => setMr(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="rank">Rank</label>
            <input id="rank" className="input" type="number" min={0} max={8} value={rank} onChange={(e) => setRank(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="rr">Re-rolls</label>
            <input id="rr" className="input" type="number" min={0} value={rerolls} onChange={(e) => setRerolls(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="kicker">Stats</h2>
        {pos.map((r, i) => (
          <StatRow key={i} row={r} negative={false} options={optionsFor(r.stat, false)} unit={unitSuffix(attrBySlug.get(r.stat))} prefix={signPrefix(attrBySlug.get(r.stat), false)}
            onChange={(nr) => setPos(pos.map((x, j) => (j === i ? nr : x)))}
            onRemove={pos.length > 2 ? () => setPos(pos.filter((_, j) => j !== i)) : undefined} />
        ))}
        {pos.length < 3 && <button type="button" className="btn" onClick={() => setPos([...pos, emptyRow()])}>+ Add stat</button>}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-orange" checked={hasNeg} onChange={(e) => setHasNeg(e.target.checked)} />
          Has a negative stat
        </label>
        {hasNeg && <StatRow row={neg} negative onChange={setNeg} options={optionsFor(neg.stat, true)} unit={unitSuffix(attrBySlug.get(neg.stat))} prefix={signPrefix(attrBySlug.get(neg.stat), true)} />}
      </div>

      <div className="card">
        <label className="label" htmlFor="notes">Notes</label>
        <textarea id="notes" className="input min-h-20 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      </div>

      {error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        {signedIn || rivenId ? (
          <button className="btn-primary flex-1" disabled={busy}>{busy ? "Saving…" : rivenId ? "Save changes" : "Save riven"}</button>
        ) : (
          <button className="btn-primary flex-1">Check this riven</button>
        )}
        {signedIn && !rivenId && (
          <button type="button" className="btn" onClick={(e) => submit(e as unknown as React.FormEvent, true)}>Check only</button>
        )}
        <button type="button" className="btn" onClick={() => router.back()}>Cancel</button>
      </div>
    </form>
  );
}
