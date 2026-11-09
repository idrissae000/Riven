import Link from "next/link";
import { RivenStats } from "@/components/riven-stats";
import type { StatGrade } from "@/lib/grading/grade";
import type { RivenAttribute, RivenStat } from "@/lib/types";

// A made-up example so the landing page shows what a result looks like. Clearly labelled as such.
const attr = (slug: string, name: string): [string, RivenAttribute] => [slug, { slug, name, unit: "percent", exclusive_to: null, positive_only: false, inverted: false, prefix: null, suffix: null }];
const ATTRS = new Map([attr("critical_chance", "Critical Chance"), attr("critical_damage", "Critical Damage"), attr("zoom", "Zoom")]);
const STATS: RivenStat[] = [
  { stat: "critical_chance", value: 193.4, is_negative: false },
  { stat: "critical_damage", value: 118.2, is_negative: false },
  { stat: "zoom", value: -52.0, is_negative: true },
];
const GRADES: StatGrade[] = [
  { stat: "critical_chance", valueAtMax: 193.4, tier: "S", pct: 0.93, range: { min: 160, max: 196 }, placeholder: false, outOfRange: false, explanation: "193.4% Critical Chance is near the top of this weapon’s 160–196% range → S" },
  { stat: "critical_damage", valueAtMax: 118.2, tier: "C", pct: 0.35, range: { min: 106, max: 140 }, placeholder: false, outOfRange: false, explanation: "118.2% Critical Damage is around the middle of this weapon’s 106–140% range → C" },
  { stat: "zoom", valueAtMax: -52, tier: "F", pct: 0.08, range: { min: -60, max: -30 }, placeholder: false, outOfRange: false, explanation: "52% Zoom is a harsh penalty — near the bottom of this weapon’s -60% to -30% penalty range (smaller is better) → F" },
];

const FEATURES = [
  { n: "01", title: "Every stat graded", body: "Not one vague grade for the whole riven. Each roll is placed between its weapon’s minimum and maximum, S down to F." },
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
