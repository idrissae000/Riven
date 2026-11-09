import Link from "next/link";
import type { ArcaneRow } from "@/lib/data";
import { ArcanePrice } from "@/components/arcane-price";
import { rarityClass } from "@/lib/arcanes/style";
import { timeAgo } from "@/lib/format";

const KIND_LABEL: Record<string, string> = { drop: "Drop", reward: "Reward", vendor: "Vendor", event: "Event", other: "Other" };
const KIND_STYLE: Record<string, string> = { drop: "border-violet/50 text-violet", reward: "border-teal/50 text-teal", vendor: "border-orange/50 text-orange", event: "border-grade-c/50 text-grade-c", other: "" };

export function ArcaneDetailView({ a }: { a: ArcaneRow }) {
  const c = a.compatibility;
  const overridden = (f: string) => a.overridden_fields.includes(f);

  return (
    <div className="space-y-5">
      <Link href="/arcanes" className="text-sm text-dim hover:text-teal">← All arcanes</Link>

      <section className="card-glow">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="h-display text-3xl">{a.name}</h1>
          <span className={`chip ${rarityClass(a.rarity)}`}>{a.rarity ?? "—"}</span>
          <span className="chip">{a.slot}</span>
          {a.max_rank != null && <span className="chip">max rank {a.max_rank}</span>}
        </div>
        <p className="mt-3 whitespace-pre-line text-ink/90">{a.description}</p>
        {overridden("description") && <p className="mt-1 text-xs text-violet">Description from your overrides.</p>}
      </section>

      <ArcanePrice slug={a.slug} tradable={!!a.wfm_slug} />

      <section className="card space-y-3">
        <h2 className="h-display text-xl text-teal">Compatibility</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-dim">Equips on</dt>
          <dd>{c.equips_on}</dd>
          <dt className="text-dim">Scales with</dt>
          <dd className="flex flex-wrap gap-1.5">
            {c.scales_with.length ? c.scales_with.map((s) => <span key={s} className="chip border-teal/40 text-teal">{s}</span>) : <span className="text-dim">The wiki lists no scaling stat for this arcane.</span>}
          </dd>
          {c.ability_scaling && (<><dt className="text-dim">Abilities</dt><dd>Benefits from ability-stat mods and arcanes (strength, duration, efficiency or energy).</dd></>)}
          {c.excludes.length > 0 && (<><dt className="text-dim">Doesn’t work with</dt><dd>{c.excludes.join(", ")}</dd></>)}
          {c.requires.length > 0 && (<><dt className="text-dim">Requires</dt><dd>{c.requires.join(", ")}</dd></>)}
          {c.playstyles.length > 0 && (<><dt className="text-dim">Playstyles</dt><dd className="flex flex-wrap gap-1.5">{c.playstyles.map((p) => <span key={p} className="chip">{p}</span>)}</dd></>)}
        </dl>

        {c.abilities.length > 0 && (
          <div>
            <h3 className="label">Abilities</h3>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {c.abilities.map((ab) => (
                <li key={ab.name} className="flex items-baseline gap-2">
                  <span className={ab.affected ? "text-ok" : "text-danger"}>{ab.affected ? "✓" : "✕"}</span>
                  <span>{ab.name}{ab.note && <span className="text-dim"> — {ab.note}</span>}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {c.notes.length > 0 && (
          <div>
            <h3 className="label">Notes from the wiki</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-dim">{c.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        )}
        {c.abilities.length === 0 && <p className="text-xs text-dim">Per-ability compatibility isn’t in the wiki’s structured data; add it in <code>data/arcane-overrides.json</code>.</p>}
        {overridden("compatibility") && <p className="text-xs text-violet">Includes data from your overrides.</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="h-display text-xl text-violet">Where to get it</h2>
        {a.drop_sources.length === 0 ? (
          <p className="text-sm text-dim">No acquisition info found on the wiki page — check the <a className="text-teal hover:underline" href={a.wiki_url} target="_blank" rel="noopener noreferrer">wiki</a>.</p>
        ) : (
          <ul className="space-y-3">
            {a.drop_sources.map((d, i) => (
              <li key={i} className="flex gap-3">
                <span className={`chip mt-0.5 h-fit shrink-0 ${KIND_STYLE[d.kind] ?? ""}`}>{KIND_LABEL[d.kind] ?? d.kind}</span>
                <div className="min-w-0 text-sm">
                  <p>{d.text}</p>
                  {d.details.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-dim">{d.details.map((x) => <li key={x}>{x}</li>)}</ul>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {overridden("drop_sources") && <p className="text-xs text-violet">Drop sources from your overrides.</p>}
        <p className="text-xs text-dim">
          Source: <a className="text-teal hover:underline" href={a.wiki_url} target="_blank" rel="noopener noreferrer">Warframe Wiki</a>
          {a.wiki_revid ? ` (revision ${a.wiki_revid})` : ""} · synced {timeAgo(a.synced_at)}. Drop tables change — verify in game.
        </p>
      </section>
    </div>
  );
}
