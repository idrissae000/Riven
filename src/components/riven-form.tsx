"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Polarity, Riven, RivenAttribute, Weapon } from "@/lib/types";
import { POLARITIES } from "@/lib/types";
import { unitSuffix } from "@/lib/format";
import { signPrefix, toStoredValue, toTypedValue } from "@/lib/stat-sign";
import type { MappedScan } from "@/lib/ocr/map";
import { encodeRiven } from "@/lib/riven-share";
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

  const [scanState, setScanState] = useState<{ busy: boolean; msg: string | null; kind: "ok" | "err" }>({ busy: false, msg: null, kind: "ok" });

  /** Prefills the form from a screenshot. Nothing is saved: the user reviews, fixes and saves as usual. */
  async function scan(file: File) {
    setScanState({ busy: true, msg: null, kind: "ok" });
    const body = new FormData();
    body.append("image", file);
    const res = await fetch("/api/rivens/scan", { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setScanState({ busy: false, msg: json.error ?? "Scan failed.", kind: "err" });
    const r = json as MappedScan;
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
      msg: (problems.length ? `Couldn’t match ${problems.join(" and ")} — pick ${problems.length > 1 ? "them" : "it"} below. ` : "Filled in from your screenshot. ") + "Please check every value before saving." + (r.notes ? ` Note: ${r.notes}` : ""),
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
      {!rivenId && signedIn && (
        <div className="card flex flex-wrap items-center gap-3 border-violet/40">
          <label className="btn cursor-pointer border-violet/50 text-violet">
            {scanState.busy ? "Reading screenshot…" : "📷 Scan a screenshot"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={scanState.busy}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void scan(f); }} />
          </label>
          <span className="text-xs text-dim">Auto-fills the form from an in-game riven card. Always double-check the numbers.</span>
          {scanState.msg && <p role="status" className={`w-full text-sm ${scanState.kind === "err" ? "text-orange" : "text-ok"}`}>{scanState.msg}</p>}
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
        <h2 className="h-display text-lg text-teal">Stats</h2>
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
