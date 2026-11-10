import Link from "next/link";
import { RivenStats } from "@/components/riven-stats";
import { gradeRiven, type StatGrade } from "@/lib/grading/grade";
import { CODEX_FIXTURE } from "@/lib/codex/fixture";
import type { RivenAttribute, RivenStat } from "@/lib/types";

// An example result, computed with the real grading code on real Codex numbers (rifle, 2 positive + 1 negative).
// The riven itself is made up and labelled "Example".
const attr = (slug: string, name: string): [string, RivenAttribute] => [slug, { slug, name, unit: "percent", exclusive_to: null, positive_only: false, inverted: false, prefix: null, suffix: null }];
const ATTRS = new Map([attr("critical_chance", "Critical Chance"), attr("critical_damage", "Critical Damage"), attr("zoom", "Zoom")]);
const STATS: RivenStat[] = [
  { stat: "critical_chance", value: 228.4, is_negative: false },
  { stat: "critical_damage", value: 171.0, is_negative: false },
  { stat: "zoom", value: -33.1, is_negative: true },
];
const GRADES: StatGrade[] = gradeRiven({ rank: 8, stats: STATS }, { name: "Soma", riven_type: "rifle" }, ATTRS, CODEX_FIXTURE);

const FEATURES = [
  { n: "01", title: "Every stat graded", body: "Not one vague grade for the whole riven. Each roll is placed between the lowest and highest it could have rolled, using the Codex calculator’s bands (S, A+ … F)." },
  { n: "02", title: "Real listings, no guesswork", body: "Price ranges come from live Warframe Market listings, and you can see exactly which ones. No listings, no number." },
  { n: "03", title: "Account optional", body: "Check as many rivens as you like without signing up. Make an account only if you want to save them." },
];

export function GuestHero() {
  return (
    <div className="space-y-10">
      <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-5">
          <p className="kicker">Riven toolkit for Tenno</p>
          <h1 className="h-display text-[2.4rem] leading-[1.02] sm:text-5xl">
            Know what your riven is <span className="text-gold">really</span> worth.
          </h1>
          <p className="max-w-md text-[1.05rem] leading-relaxed text-dim">
            Enter the stats — or paste a screenshot — and get a grade for every roll plus what comparable rivens are listed for right now.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/rivens/new" className="btn-primary">Check a riven</Link>
            <Link href="/arcanes" className="btn">Browse arcanes</Link>
          </div>
        </div>

        <div className="card-glow">
          <div className="flex items-center justify-between">
            <p className="font-display text-xl font-bold uppercase tracking-wide">Soma <span className="text-violet">Crita-cron</span></p>
            <span className="chip border-gold/40 text-gold">Example</span>
          </div>
          <RivenStats stats={STATS} attrs={ATTRS} grades={GRADES} />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.n} className="card">
            <p className="font-mono text-xs text-gold">{f.n}</p>
            <h3 className="mt-1 font-display text-base font-bold uppercase tracking-[0.08em]">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-dim">{f.body}</p>
          </div>
        ))}
      </section>

      <p className="text-center text-sm text-dim">
        Want to keep your rivens? <Link href="/login" className="text-teal hover:underline">Sign in</Link> to save them, list on Warframe Market and track them.
      </p>
    </div>
  );
}
