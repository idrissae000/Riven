/**
 * Live Warframe world state, from the community API api.warframestat.us (which parses the game's own world state feed).
 * `normalizeWorldState` keeps only what the Live page shows and tolerates missing pieces, so a change in the feed
 * degrades a section instead of breaking the page.
 */
const SOURCE = "https://api.warframestat.us/pc?language=en";

export interface Cycle { id: string; name: string; state: string; expiry: string }
export interface Fissure { id: string; node: string; planet: string; missionType: string; tier: string; tierNum: number; enemy: string; expiry: string; steelPath: boolean; storm: boolean }
export interface BaroItem { item: string; ducats: number | null; credits: number | null }
export interface Baro { location: string; arrives: string; leaves: string; items: BaroItem[] }
/** Varzia's Prime Resurgence: `regal` / `aya` are the two cost fields the feed gives (it files them as "ducats" / "credits"). */
export interface VarziaItem { item: string; regal: number | null; aya: number | null }
export interface Varzia { location: string; activation: string; expiry: string; items: VarziaItem[] }
export interface MissionLine { node: string; type: string; modifier: string | null }
export interface Teshin { current: { name: string; cost: number } | null; expiry: string | null; rotation: { name: string; cost: number }[] }
export interface Invasion { id: string; node: string; title: string; attacker: { faction: string; reward: string | null }; defender: { faction: string; reward: string | null }; completion: number }
export interface Darvo { item: string; originalPrice: number; salePrice: number; discount: number; sold: number; total: number; expiry: string }
export interface NightwaveChallenge { id: string; title: string; desc: string; reputation: number; daily: boolean; elite: boolean; expiry: string }
export interface DuviriChoices { category: string; choices: string[] }

export interface WorldState {
  fetchedAt: string;
  cycles: Cycle[];
  duviri: { expiry: string; choices: DuviriChoices[] } | null;
  fissures: Fissure[];
  baro: Baro | null;
  varzia: Varzia | null;
  sortie: { expiry: string; missions: MissionLine[] } | null;
  archon: { expiry: string; missions: MissionLine[] } | null;
  teshin: Teshin | null;
  invasions: Invasion[];
  darvo: Darvo | null;
  nightwave: { season: number; challenges: NightwaveChallenge[] } | null;
}

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const isArr = (x: unknown): x is Raw[] => Array.isArray(x);
const arr = (x: unknown): Raw[] => (Array.isArray(x) ? (x as Raw[]) : []);
const str = (x: unknown) => (typeof x === "string" ? x : "");
const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
const future = (iso: unknown, now: number) => typeof iso === "string" && Date.parse(iso) > now;

function rewardText(r: Raw | undefined): string | null {
  if (!r) return null;
  const parts: string[] = [];
  for (const c of arr(r.countedItems)) parts.push(`${c.count && c.count > 1 ? `${c.count}x ` : ""}${str(c.type)}`);
  for (const i of arr(r.items)) parts.push(String(i));
  if (num(r.credits)) parts.push(`${(r.credits as number).toLocaleString("en-US")} credits`);
  return parts.length ? parts.join(", ") : null;
}

const mission = (m: Raw): MissionLine => ({ node: str(m.node ?? m.nodeKey), type: str(m.missionType ?? m.type), modifier: str(m.modifier) || null });

export function normalizeWorldState(raw: Raw, now: number = Date.now()): WorldState {
  const cycle = (id: string, name: string, key: string, labels?: Record<string, string>): Cycle[] => {
    const c = raw[key];
    // kept even if its timer has just run out (the feed lags by a minute or so): the countdown then reads "now"
    return c && typeof c.expiry === "string" ? [{ id, name, state: labels?.[str(c.state)] ?? str(c.state), expiry: c.expiry }] : [];
  };
  const cycles = [
    ...cycle("earth", "Earth", "earthCycle"), ...cycle("cetus", "Plains of Eidolon", "cetusCycle"),
    ...cycle("vallis", "Orb Vallis", "vallisCycle"), ...cycle("cambion", "Cambion Drift", "cambionCycle"),
    ...cycle("zariman", "Zariman", "zarimanCycle", { grineer: "Grineer-held", corpus: "Corpus-held" }),
  ];

  const duviri = raw.duviriCycle && typeof raw.duviriCycle.expiry === "string"
    ? { expiry: raw.duviriCycle.expiry as string, choices: arr(raw.duviriCycle.choices).map((c) => ({ category: str(c.category), choices: (c.choices ?? []).map(String) })) }
    : null;
  if (duviri) cycles.push({ id: "duviri", name: "Duviri", state: str(raw.duviriCycle.state), expiry: duviri.expiry });

  const fissures: Fissure[] = arr(raw.fissures)
    .filter((f) => future(f.expiry, now))
    .map((f) => ({
      id: str(f.id), node: str(f.node), planet: /\((.+)\)/.exec(str(f.node))?.[1] ?? "", missionType: str(f.missionType), tier: str(f.tier), tierNum: num(f.tierNum) ?? 9,
      enemy: str(f.enemy), expiry: str(f.expiry), steelPath: !!f.isHard, storm: !!f.isStorm,
    }))
    .sort((a, b) => a.tierNum - b.tierNum || Date.parse(a.expiry) - Date.parse(b.expiry));

  const vt = isArr(raw.voidTraders) ? raw.voidTraders.find((v) => str(v.character).includes("Baro")) : raw.voidTrader;
  const baro: Baro | null = vt && future(vt.expiry, now)
    ? { location: str(vt.location), arrives: str(vt.activation), leaves: str(vt.expiry), items: arr(vt.inventory).map((i) => ({ item: str(i.item), ducats: num(i.ducats), credits: num(i.credits) })) }
    : null;

  const vz = raw.vaultTrader;
  const varzia: Varzia | null = vz && future(vz.expiry, now)
    ? { location: str(vz.location), activation: str(vz.activation), expiry: str(vz.expiry), items: arr(vz.inventory).map((i) => ({ item: str(i.item), regal: num(i.ducats), aya: num(i.credits) })) }
    : null;

  const missions = (src: Raw | undefined, key: "variants" | "missions") =>
    src && future(src.expiry, now) ? { expiry: str(src.expiry), missions: arr(src[key]).map(mission) } : null;
  const sortie = missions(raw.sortie, "variants");
  const archon = missions(raw.archonHunt, "missions");

  const sp = raw.steelPath;
  const teshin: Teshin | null = sp ? {
    current: sp.currentReward ? { name: str(sp.currentReward.name), cost: num(sp.currentReward.cost) ?? 0 } : null,
    expiry: str(sp.expiry) || null,
    rotation: arr(sp.rotation).map((r) => ({ name: str(r.name), cost: num(r.cost) ?? 0 })),
  } : null;

  const invasions: Invasion[] = arr(raw.invasions).filter((i) => !i.completed).map((i) => ({
    id: str(i.id), node: str(i.node), title: str(i.desc), completion: Math.max(0, Math.min(100, num(i.completion) ?? 0)),
    attacker: { faction: str(i.attacker?.faction), reward: rewardText(i.attacker?.reward) }, defender: { faction: str(i.defender?.faction), reward: rewardText(i.defender?.reward) },
  }));

  const d = isArr(raw.dailyDeals) ? raw.dailyDeals[0] : null;
  const darvo: Darvo | null = d && future(d.expiry, now)
    ? { item: str(d.item), originalPrice: num(d.originalPrice) ?? 0, salePrice: num(d.salePrice) ?? 0, discount: num(d.discount) ?? 0, sold: num(d.sold) ?? 0, total: num(d.total) ?? 0, expiry: str(d.expiry) }
    : null;

  const nw = raw.nightwave;
  const nightwave = nw && isArr(nw.activeChallenges)
    ? { season: num(nw.season) ?? 0, challenges: arr(nw.activeChallenges).filter((c) => future(c.expiry, now)).map((c): NightwaveChallenge => ({ id: str(c.id), title: str(c.title), desc: str(c.desc), reputation: num(c.reputation) ?? 0, daily: !!c.isDaily, elite: !!c.isElite, expiry: str(c.expiry) })) }
    : null;

  return { fetchedAt: new Date(now).toISOString(), cycles, duviri, fissures, baro, varzia, sortie, archon, teshin, invasions, darvo, nightwave };
}

let cache: { at: number; value: WorldState } | null = null;

/** The world state, cached for 60 seconds per server instance; if the feed is down, the last good copy is returned (flagged by its fetchedAt). */
export async function getWorldState(): Promise<{ state: WorldState | null; stale: boolean }> {
  if (cache && Date.now() - cache.at < 60_000) return { state: cache.value, stale: false };
  try {
    const res = await fetch(SOURCE, { headers: { Accept: "application/json", "User-Agent": "WarframeEconomist/0.1 (live page)" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`world state ${res.status}`);
    const value = normalizeWorldState((await res.json()) as Raw);
    cache = { at: Date.now(), value };
    return { state: value, stale: false };
  } catch {
    return { state: cache?.value ?? null, stale: !!cache };
  }
}
