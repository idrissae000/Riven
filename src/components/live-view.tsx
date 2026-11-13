"use client";

import { useState } from "react";
import { Countdown } from "@/components/countdown";
import { FissureList } from "@/components/fissure-list";
import { Segmented } from "@/components/segmented";
import type { MissionLine, WorldState } from "@/lib/worldstate";

type Tab = "now" | "fissures" | "missions" | "invasions";

const Tile = ({ title, state, expiry, note }: { title: string; state: string; expiry: string; note?: string }) => (
  <div className="border border-line bg-panel-2/40 p-3">
    <p className="text-xs uppercase tracking-wider text-dim">{title}</p>
    <p className="mt-0.5 font-display text-lg font-semibold capitalize">{state}</p>
    <p className="text-xs text-dim">{note ?? "changes in"} <Countdown to={expiry} expiredText="any moment" /></p>
  </div>
);

function Missions({ missions }: { missions: MissionLine[] }) {
  return (
    <ol className="space-y-2 text-sm">
      {missions.map((m, i) => (
        <li key={i}>
          <span className="mr-2 font-mono text-xs text-dim">{i + 1}</span><b>{m.type}</b> <span className="text-dim">· {m.node}</span>
          {m.modifier && <p className="ml-5 text-xs text-dim">{m.modifier}</p>}
        </li>
      ))}
    </ol>
  );
}

/** One collapsible block, so a tab shows a few headings instead of everything at once. */
const Fold = ({ title, meta, open, children }: { title: string; meta?: React.ReactNode; open?: boolean; children: React.ReactNode }) => (
  <details open={open} className="group card !p-0">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
      <span className="kicker">{title}</span>
      <span className="flex items-center gap-3 text-xs text-dim">{meta}<span aria-hidden className="transition-transform group-open:rotate-180">▾</span></span>
    </summary>
    <div className="border-t border-line px-4 py-3">{children}</div>
  </details>
);

/** The live world state, split into four tabs so only one concern is on screen at a time. */
export function LiveView({ ws }: { ws: WorldState }) {
  const [tab, setTab] = useState<Tab>("now");
  const [allInvasions, setAllInvasions] = useState(false);
  const baroSoon = ws.baro && Date.parse(ws.baro.arrives) > Date.parse(ws.fetchedAt);
  const invasions = allInvasions ? ws.invasions : ws.invasions.slice(0, 6);

  return (
    <div className="space-y-5">
      <Segmented label="Live sections" value={tab} onChange={setTab} options={[
        { value: "now", label: "Now" }, { value: "fissures", label: "Fissures", count: ws.fissures.length },
        { value: "missions", label: "Missions" }, { value: "invasions", label: "Invasions", count: ws.invasions.length },
      ]} />

      {tab === "now" && (
        <div className="space-y-5">
          <section>
            <h2 className="kicker mb-3">Cycles</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ws.cycles.map((c) => <Tile key={c.id} title={c.name} state={c.state} expiry={c.expiry} />)}
            </div>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            {ws.baro && (
              <section className="card space-y-2">
                <div className="flex items-baseline justify-between gap-3"><h2 className="kicker">Baro Ki’Teer <a href="/baro" className="ml-2 normal-case tracking-normal text-teal hover:underline">price picks →</a></h2><span className="text-xs text-dim">{baroSoon ? <>arrives in <Countdown to={ws.baro.arrives} /></> : <>leaves in <Countdown to={ws.baro.leaves} /></>}</span></div>
                <p className="text-sm"><b>{ws.baro.location}</b></p>
                {ws.baro.items.length > 0 ? (
                  <ul className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
                    {ws.baro.items.map((i) => <li key={i.item} className="flex justify-between gap-2"><span className="truncate font-sans text-ink">{i.item}</span><span className="shrink-0 text-dim">{i.ducats ?? "—"}d · {i.credits?.toLocaleString("en-US") ?? "—"}cr</span></li>)}
                  </ul>
                ) : <p className="text-xs text-dim">His inventory appears when he arrives.</p>}
              </section>
            )}
            {ws.duviri && (
              <section className="card space-y-2">
                <div className="flex items-baseline justify-between gap-3"><h2 className="kicker">The Circuit</h2><span className="text-xs text-dim">resets in <Countdown to={ws.duviri.expiry} /></span></div>
                {ws.duviri.choices.map((c) => <p key={c.category} className="text-sm"><b>{c.category === "hard" ? "Steel Path" : "Normal"}:</b> <span className="text-dim">{c.choices.join(", ")}</span></p>)}
              </section>
            )}
            {ws.darvo && (
              <section className="card space-y-1">
                <div className="flex items-baseline justify-between gap-3"><h2 className="kicker">Darvo’s deal</h2><span className="text-xs text-dim">ends in <Countdown to={ws.darvo.expiry} /></span></div>
                <p className="text-sm"><b>{ws.darvo.item}</b> — <span className="text-plat">{ws.darvo.salePrice}</span> <span className="text-dim line-through">{ws.darvo.originalPrice}</span> plat ({ws.darvo.discount}% off)</p>
                <p className="text-xs text-dim">{ws.darvo.sold} of {ws.darvo.total} sold</p>
              </section>
            )}
            {ws.teshin?.current && (
              <section className="card space-y-1">
                <div className="flex items-baseline justify-between gap-3"><h2 className="kicker">Teshin · Steel Path</h2>{ws.teshin.expiry && <span className="text-xs text-dim">rotates in <Countdown to={ws.teshin.expiry} /></span>}</div>
                <p className="text-sm">This week: <b>{ws.teshin.current.name}</b> <span className="text-dim">· {ws.teshin.current.cost} essence</span></p>
                <details className="text-xs text-dim"><summary className="cursor-pointer text-gold">Full rotation</summary><p className="mt-1">{ws.teshin.rotation.map((r) => r.name).join(" → ")}</p></details>
              </section>
            )}
          </div>
        </div>
      )}

      {tab === "fissures" && <FissureList fissures={ws.fissures} />}

      {tab === "missions" && (
        <div className="space-y-3">
          {ws.sortie && <Fold title="Sortie" open meta={<>resets in <Countdown to={ws.sortie.expiry} /></>}><Missions missions={ws.sortie.missions} /></Fold>}
          {ws.archon && <Fold title="Archon hunt" meta={<>resets in <Countdown to={ws.archon.expiry} /></>}><Missions missions={ws.archon.missions} /></Fold>}
          {ws.nightwave && ws.nightwave.challenges.length > 0 && (
            <Fold title={`Nightwave · season ${ws.nightwave.season}`} meta={`${ws.nightwave.challenges.length} active`}>
              <ul className="space-y-2 text-sm">
                {ws.nightwave.challenges.map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-3">
                    <span><b>{c.title}</b> <span className="text-dim">— {c.desc}</span></span>
                    <span className="shrink-0 font-mono text-xs text-dim">{c.reputation.toLocaleString("en-US")}{c.elite ? " · elite" : c.daily ? " · daily" : ""}</span>
                  </li>
                ))}
              </ul>
            </Fold>
          )}
        </div>
      )}

      {tab === "invasions" && (
        <div className="space-y-3">
          {ws.invasions.length === 0 && <p className="text-sm text-dim">No active invasions.</p>}
          <ul className="grid gap-2 md:grid-cols-2">
            {invasions.map((i) => (
              <li key={i.id} className="tile space-y-1.5 text-sm">
                <p><b>{i.node}</b> <span className="text-dim">· {i.title}</span></p>
                <p className="text-xs text-dim"><span className="text-ink">{i.attacker.faction}</span> {i.attacker.reward ?? "—"} <span className="mx-1">vs</span> <span className="text-ink">{i.defender.faction}</span> {i.defender.reward ?? "—"}</p>
                <div className="h-1.5 w-full bg-panel-2"><div className="h-full bg-teal" style={{ width: `${i.completion}%` }} /></div>
              </li>
            ))}
          </ul>
          {ws.invasions.length > 6 && <button className="btn w-full" onClick={() => setAllInvasions((v) => !v)}>{allInvasions ? "Show fewer" : `Show all ${ws.invasions.length}`}</button>}
        </div>
      )}
    </div>
  );
}
