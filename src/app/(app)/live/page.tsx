import { Countdown } from "@/components/countdown";
import { FissureList } from "@/components/fissure-list";
import { PageHeader } from "@/components/page-header";
import { getWorldState, type MissionLine } from "@/lib/worldstate";

export const metadata = { title: "Live" };
export const dynamic = "force-dynamic";

function Missions({ missions }: { missions: MissionLine[] }) {
  return (
    <ol className="space-y-1.5 text-sm">
      {missions.map((m, i) => (
        <li key={i}>
          <span className="mr-2 font-mono text-xs text-dim">{i + 1}</span><b>{m.type}</b> <span className="text-dim">· {m.node}</span>
          {m.modifier && <p className="ml-5 text-xs text-dim">{m.modifier}</p>}
        </li>
      ))}
    </ol>
  );
}

const Card = ({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) => (
  <section className="card space-y-3">
    <div className="flex items-center justify-between gap-3"><h2 className="kicker">{title}</h2>{right}</div>
    {children}
  </section>
);

export default async function LivePage() {
  const { state: ws, stale } = await getWorldState();
  if (!ws) {
    return (
      <div className="space-y-5">
        <PageHeader kicker="World state" title="Live" />
        <p className="card text-sm text-dim">The world state feed isn’t answering right now. Try again in a minute.</p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <PageHeader kicker="World state" title="Live" />
      {stale && <p className="text-xs text-orange">The live feed didn’t answer, so this is the last copy we have (from {new Date(ws.fetchedAt).toUTCString()}).</p>}

      <Card title="Day / night cycles">
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {ws.cycles.map((c) => (
            <li key={c.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span><b>{c.name}</b> <span className="chip ml-1 capitalize">{c.state}</span></span>
              <span className="text-xs text-dim">changes in <Countdown to={c.expiry} /></span>
            </li>
          ))}
        </ul>
        {ws.duviri && (
          <div className="border-t border-line pt-3 text-sm">
            <p className="text-xs text-dim">The Circuit this rotation (resets in <Countdown to={ws.duviri.expiry} />)</p>
            {ws.duviri.choices.map((c) => <p key={c.category} className="mt-1"><b className="capitalize">{c.category === "hard" ? "Steel Path" : "Normal"}:</b> <span className="text-dim">{c.choices.join(", ")}</span></p>)}
          </div>
        )}
      </Card>

      {ws.baro && (
        <Card title="Baro Ki’Teer" right={<span className="text-xs text-dim">{Date.parse(ws.baro.arrives) > Date.parse(ws.fetchedAt) ? <>arrives in <Countdown to={ws.baro.arrives} /></> : <>leaves in <Countdown to={ws.baro.leaves} /></>}</span>}>
          <p className="text-sm"><b>{ws.baro.location}</b></p>
          {ws.baro.items.length > 0 ? (
            <ul className="grid gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-2">
              {ws.baro.items.map((i) => <li key={i.item} className="flex justify-between gap-2"><span className="truncate font-sans text-ink">{i.item}</span><span className="shrink-0 text-dim">{i.ducats ?? "—"} ducats · {i.credits?.toLocaleString("en-US") ?? "—"} cr</span></li>)}
            </ul>
          ) : <p className="text-xs text-dim">His inventory appears once he arrives.</p>}
        </Card>
      )}

      <Card title={`Void fissures (${ws.fissures.length})`}><FissureList fissures={ws.fissures} /></Card>

      <div className="grid gap-5 md:grid-cols-2">
        {ws.sortie && <Card title="Sortie" right={<span className="text-xs text-dim">resets in <Countdown to={ws.sortie.expiry} /></span>}><Missions missions={ws.sortie.missions} /></Card>}
        {ws.archon && <Card title="Archon hunt" right={<span className="text-xs text-dim">resets in <Countdown to={ws.archon.expiry} /></span>}><Missions missions={ws.archon.missions} /></Card>}
      </div>

      {ws.teshin && ws.teshin.current && (
        <Card title="Teshin · Steel Path honors" right={ws.teshin.expiry ? <span className="text-xs text-dim">rotates in <Countdown to={ws.teshin.expiry} /></span> : null}>
          <p className="text-sm">This week: <b>{ws.teshin.current.name}</b> <span className="text-dim">· {ws.teshin.current.cost} Steel Essence</span></p>
          <p className="text-xs text-dim">Rotation: {ws.teshin.rotation.map((r) => r.name).join(" → ")}</p>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {ws.darvo && (
          <Card title="Darvo’s daily deal" right={<span className="text-xs text-dim">ends in <Countdown to={ws.darvo.expiry} /></span>}>
            <p className="text-sm"><b>{ws.darvo.item}</b> — <span className="text-plat">{ws.darvo.salePrice}</span> <span className="text-dim line-through">{ws.darvo.originalPrice}</span> platinum ({ws.darvo.discount}% off)</p>
            <p className="text-xs text-dim">{ws.darvo.sold} of {ws.darvo.total} sold</p>
          </Card>
        )}
        {ws.nightwave && ws.nightwave.challenges.length > 0 && (
          <Card title={`Nightwave · season ${ws.nightwave.season}`}>
            <ul className="space-y-1.5 text-sm">
              {ws.nightwave.challenges.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-3">
                  <span><b>{c.title}</b> <span className="text-dim">— {c.desc}</span></span>
                  <span className="shrink-0 font-mono text-xs text-dim">{c.reputation.toLocaleString("en-US")}{c.elite ? " · elite" : c.daily ? " · daily" : ""}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {ws.invasions.length > 0 && (
        <Card title={`Invasions (${ws.invasions.length})`}>
          <ul className="divide-y divide-line">
            {ws.invasions.map((i) => (
              <li key={i.id} className="space-y-1 py-2 text-sm">
                <p><b>{i.node}</b> <span className="text-dim">· {i.title}</span></p>
                <p className="text-xs text-dim">{i.attacker.faction}: {i.attacker.reward ?? "—"} · {i.defender.faction}: {i.defender.reward ?? "—"}</p>
                <div className="h-1.5 w-full bg-panel-2"><div className="h-full bg-teal" style={{ width: `${i.completion}%` }} /></div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-xs text-dim">Data from api.warframestat.us, refreshed about once a minute.</p>
    </div>
  );
}
