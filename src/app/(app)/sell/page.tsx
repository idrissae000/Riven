import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { currentUserId } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { sessionInfo, wfmConfigured } from "@/lib/wfm/auth";

export const metadata = { title: "Sell in bulk" };

type State = "done" | "next" | "todo";

export default async function SellPage() {
  const uid = await currentUserId();
  let items = 0, rivens = 0, listedRivens = 0, connectedAs: string | null | undefined, connected = false, auto = false;
  if (uid) {
    const sb = await createClient();
    const [inv, riv, listed, session, settings] = await Promise.all([
      sb.from("inventory_items").select("id", { count: "exact", head: true }),
      sb.from("rivens").select("id", { count: "exact", head: true }),
      sb.from("rivens").select("id", { count: "exact", head: true }).not("wfm_auction_id", "is", null),
      wfmConfigured() ? sessionInfo(uid) : Promise.resolve({ connected: false, name: null }),
      sb.from("autoprice_settings").select("enabled").maybeSingle(),
    ]);
    items = inv.count ?? 0; rivens = riv.count ?? 0; listedRivens = listed.count ?? 0;
    connected = session.connected; connectedAs = session.name; auto = !!settings.data?.enabled;
  }
  const hasStuff = items + rivens > 0;
  const s1: State = !uid ? "todo" : hasStuff ? "done" : "next";
  const s2: State = !uid ? "todo" : connected ? "done" : hasStuff ? "next" : "todo";
  const s3: State = !uid ? "todo" : connected && hasStuff ? "next" : "todo";
  const s4: State = !uid ? "todo" : auto ? "done" : connected ? "next" : "todo";

  return (
    <div className="space-y-6">
      <PageHeader kicker="Warframe Market" title="Sell in bulk" />
      <p className="max-w-2xl text-[1.02rem] leading-relaxed text-dim">Get everything you own onto Warframe Market at a sensible price, then keep it competitive. Four steps; each one tells you where you are.</p>

      {!uid && (
        <div className="card-glow flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-dim">Everything here saves to your Warframe Economist account (free, optional). Sign in to start.</p>
          <Link href="/login?next=/sell" className="btn-primary">Sign in</Link>
        </div>
      )}

      <ol className="space-y-3">
        <Step n={1} state={s1} title="Add what you have" status={!uid ? null : hasStuff ? `${items} item${items === 1 ? "" : "s"}${rivens ? ` · ${rivens} riven${rivens === 1 ? "" : "s"}` : ""} saved` : "Nothing saved yet"}
          body="Drop in screenshots of your Prime parts or arcanes (or a mission’s rewards) and the site reads them for you. Or type them in. Rivens go in separately."
          actions={<><Link href="/inventory/scan" className="btn-primary">Scan screenshots</Link><Link href="/inventory" className="btn">Add by hand</Link><Link href="/rivens/new" className="btn">Add a riven</Link></>} />
        <Step n={2} state={s2} title="Connect Warframe Market" status={!uid ? null : connected ? `Connected${connectedAs ? ` as ${connectedAs}` : ""}` : "Not connected"}
          body="So the site can list for you. Your password is used once to sign in and is never stored. You can disconnect any time."
          actions={<Link href="/market" className={connected ? "btn" : "btn-primary"}>{connected ? "Manage connection" : "Connect"}</Link>} />
        <Step n={3} state={s3} title="Price and list in bulk" status={!uid ? null : listedRivens ? `${listedRivens} riven${listedRivens === 1 ? "" : "s"} listed` : null}
          body="Tick what to sell, choose how to price it (below), set a lowest price you’ll accept, and list the lot in one go. Complete Prime sets can be combined and listed as a set."
          actions={<><Link href="/inventory" className="btn-primary">List my parts and arcanes</Link><Link href="/inventory/rivens" className="btn">List my rivens</Link></>} />
        <Step n={4} state={s4} title="Keep your prices competitive" status={!uid ? null : auto ? "Undercut protection is on" : "Undercut protection is off"}
          body="See which orders have been undercut and reprice them in one click, hide or remove orders in bulk, or switch on undercut protection and let the site lower them for you."
          actions={<Link href="/inventory/listings" className="btn-primary">Open my listings</Link>} />
      </ol>

      <section className="card space-y-3">
        <h2 className="kicker">How the price is chosen</h2>
        <p className="text-sm leading-relaxed text-dim">Only players who are <b className="text-ink">online or in-game right now</b> count, because those are the ones who’ll actually buy. The site looks at the 5 cheapest such sellers and offers three ways to price yours:</p>
        <ul className="grid gap-3 sm:grid-cols-3">
          <Rule title="Market price" body="The average of the 5 cheapest. A fair price that sells at a steady pace." />
          <Rule title="Undercut by 1" body="1 platinum below the cheapest seller. Sells first, but earns the least." />
          <Rule title="Match the cheapest" body="The same as the lowest. Sells about as fast as they do." />
        </ul>
        <p className="text-sm leading-relaxed text-dim">Whatever you pick, a <b className="text-ink">minimum price</b> stops anything going below what you’d accept. Prices on the site refresh every few minutes; check a listing before you commit.</p>
      </section>

      <section className="card space-y-1.5">
        <h2 className="kicker">Selling a riven?</h2>
        <p className="text-sm text-dim">Rivens work the same way. Enter its stats to get a grade for every roll and what similar rivens sell for, then list it from its page.</p>
        <div className="pt-1"><Link href="/rivens/new" className="btn">Check a riven</Link></div>
      </section>
    </div>
  );
}

function Step({ n, state, title, status, body, actions }: { n: number; state: State; title: string; status: string | null; body: string; actions: React.ReactNode }) {
  const ring = state === "done" ? "border-ok text-ok" : state === "next" ? "border-gold text-gold" : "border-line-2 text-dim";
  return (
    <li className={`card flex gap-4 ${state === "next" ? "border-gold/50" : ""}`}>
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-display text-lg font-bold ${ring}`} aria-label={state === "done" ? "Done" : state === "next" ? "Do this next" : "Later"}>{state === "done" ? "✓" : n}</span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <h2 className="font-display text-lg font-bold uppercase tracking-[0.06em]">{title}</h2>
          {status && <span className={`text-xs ${state === "done" ? "text-ok" : "text-dim"}`}>{status}</span>}
        </div>
        <p className="text-sm leading-relaxed text-dim">{body}</p>
        <div className="flex flex-wrap gap-2 pt-1">{actions}</div>
      </div>
    </li>
  );
}
function Rule({ title, body }: { title: string; body: string }) {
  return <li className="tile"><h3 className="font-display text-sm font-bold uppercase tracking-[0.08em] text-gold">{title}</h3><p className="mt-1 text-sm text-dim">{body}</p></li>;
}
