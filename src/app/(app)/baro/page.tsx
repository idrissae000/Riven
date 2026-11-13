import Link from "next/link";
import { BaroAway, type AwayRow } from "@/components/baro-away";
import { BaroPicks, type BaroRow } from "@/components/baro-picks";
import { Countdown } from "@/components/countdown";
import { PageHeader } from "@/components/page-header";
import { PriceRefresher } from "@/components/price-refresher";
import { baroDue } from "@/lib/baro/due";
import { TRACK_TTL_MS } from "@/lib/baro/refresh";
import { createClient } from "@/lib/supabase/server";
import { getWorldState } from "@/lib/worldstate";
import type { Confidence } from "@/lib/baro/analysis";
import type { AskingDay } from "@/lib/chart";
import type { SalesDay } from "@/lib/history-sales";

export const metadata = { title: "Baro Ki’Teer" };

type Sb = Awaited<ReturnType<typeof createClient>>;

/** 100 days of daily sales (and our asking-price snapshots) for these items, keyed by slug. */
async function loadHistory(sb: Sb, slugs: string[], before: string) {
  const history: Record<string, SalesDay[]> = {};
  const asking: Record<string, AskingDay[]> = {};
  if (!slugs.length) return { history, asking };
  const since = new Date(Date.parse(before) - 100 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: sales }, { data: snaps }] = await Promise.all([
    sb.from("sales_history").select("slug,day,avg_price,min_price,max_price,volume").in("slug", slugs).gte("day", since).order("day").limit(5000),
    sb.from("price_history").select("slug,day,price,listings").in("slug", slugs).gte("day", since).order("day").limit(5000),
  ]);
  for (const s of (sales ?? []) as Record<string, unknown>[]) (history[s.slug as string] ??= []).push({ day: s.day as string, avg: Number(s.avg_price), min: s.min_price == null ? null : Number(s.min_price), max: s.max_price == null ? null : Number(s.max_price), volume: Number(s.volume ?? 0) });
  for (const s of (snaps ?? []) as Record<string, unknown>[]) (asking[s.slug as string] ??= []).push({ day: s.day as string, price: Number(s.price), listings: Number(s.listings ?? 0) });
  return { history, asking };
}

export default async function BaroPage() {
  const { state } = await getWorldState();
  const baro = state?.baro ?? null;
  // "here" = he has arrived (the feed's arrival time has passed) and has stock
  const here = !!baro && !!state && baro.items.length > 0 && Date.parse(baro.arrives) <= Date.parse(state.fetchedAt);
  const sb = await createClient();
  const num = (v: unknown) => (v == null ? null : Number(v));

  let body: React.ReactNode = null;

  if (baro && here) {
    const visit = new Date(baro.arrives).toISOString();
    const { data } = await sb.from("baro_items").select("name,ducats,credits,wfm_slug,price_now,pre_price,listings,ratio_short,ratio_long,dip_share,cycles,confidence,computed_at").eq("visit", visit);
    const stored = new Map(((data ?? []) as Record<string, unknown>[]).map((r) => [r.name as string, r]));
    const rows = baro.items.map((i): BaroRow => {
      const r = stored.get(i.item);
      return {
        name: i.item, ducats: i.ducats, credits: i.credits, slug: (r?.wfm_slug as string | null | undefined) ?? null,
        priceNow: num(r?.price_now), pre: num(r?.pre_price), listings: Number(r?.listings ?? 0), ratioShort: num(r?.ratio_short), ratioLong: num(r?.ratio_long), dipShare: num(r?.dip_share),
        cycles: Number(r?.cycles ?? 0), confidence: ((r?.confidence as Confidence | undefined) ?? "none"), ready: !!r?.computed_at,
      };
    });
    const { history } = await loadHistory(sb, rows.flatMap((r) => (r.slug ? [r.slug] : [])), baro.arrives);
    const due = baroDue(baro.items, ((data ?? []) as { name: string; wfm_slug: string | null; computed_at: string | null }[]));
    body = (
      <>
        <section className="card flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm"><b>{baro.location}</b> <span className="text-dim">· leaves in <Countdown to={baro.leaves} /></span></p>
          <p className="text-xs text-dim">{rows.length} items · {rows.filter((r) => r.slug).length} tradable</p>
        </section>
        <PriceRefresher due={due} endpoint="/api/baro/refresh" />
        <BaroPicks rows={rows} history={history} arrival={baro.arrives} />
      </>
    );
  } else {
    // away: follow the items from his most recent visit
    const { data: latest } = await sb.from("baro_items").select("visit").order("visit", { ascending: false }).limit(1);
    const visit = (latest?.[0]?.visit as string | undefined) ?? null;
    const { data } = visit ? await sb.from("baro_items").select("name,ducats,credits,wfm_slug,price_now,computed_at").eq("visit", visit).not("wfm_slug", "is", null) : { data: [] };
    const stored = (data ?? []) as { name: string; ducats: number | null; credits: number | null; wfm_slug: string; price_now: number | string | null; computed_at: string | null }[];
    const rows: AwayRow[] = stored.map((r) => ({ name: r.name, ducats: r.ducats, credits: r.credits, slug: r.wfm_slug, priceNow: num(r.price_now) }));
    const { history, asking } = visit ? await loadHistory(sb, rows.map((r) => r.slug), new Date(visit).toISOString()) : { history: {}, asking: {} };
    const due = baroDue(stored.map((r) => ({ item: r.name })), stored.map((r) => ({ name: r.name, wfm_slug: r.wfm_slug, computed_at: r.computed_at })), undefined, TRACK_TTL_MS);
    body = (
      <>
        <section className="card flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="text-ink">{baro ? <>Baro is away — back in <Countdown to={baro.arrives} />{baro.location ? <> at <b>{baro.location}</b></> : null}.</> : "Baro is away."}</p>
            <p className="text-dim">Until then, here’s how what he brought last time is selling compared to the days he was here.</p>
          </div>
        </section>
        {visit && rows.length > 0 ? (
          <>
            <PriceRefresher due={due} endpoint="/api/baro/refresh" />
            <BaroAway rows={rows} history={history} asking={asking} arrival={visit} />
          </>
        ) : (
          <p className="card text-sm text-dim">No previous visit has been recorded yet — tracking starts with his current stay and carries on after he leaves. His stock and our picks appear here the moment he lands.</p>
        )}
      </>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader kicker="Void Trader" title="Baro Ki’Teer">
        <Link href="/live" className="btn">Live world state</Link>
      </PageHeader>
      {state ? body : <p className="card text-sm text-dim">Couldn’t load Baro’s status from the world-state feed right now. Try again in a minute.</p>}
    </div>
  );
}
