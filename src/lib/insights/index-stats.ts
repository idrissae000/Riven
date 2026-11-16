export interface IndexPoint { day: string; idx: number }
export interface IndexStats { now: number; change7: number | null; change30: number | null; high: IndexPoint; low: IndexPoint; /** where today sits between the 90-day low (0) and high (100) */ position: number; start: number }

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Smooths daily noise with a 3-day average, then reads the index: today's level, the 7- and 30-day changes, and where it sits in its 90-day range. */
export function smooth(points: IndexPoint[]): IndexPoint[] {
  return points.map((p, i) => { const w = points.slice(Math.max(0, i - 2), i + 1); return { day: p.day, idx: r1(w.reduce((s, x) => s + x.idx, 0) / w.length) }; });
}

export function indexStats(points: IndexPoint[]): IndexStats | null {
  if (points.length < 14) return null;
  const s = smooth(points), last = s[s.length - 1];
  const back = (n: number) => (s.length > n ? s[s.length - 1 - n].idx : null);
  const pct = (b: number | null) => (b ? r1(((last.idx - b) / b) * 100) : null);
  const high = s.reduce((a, b) => (b.idx > a.idx ? b : a)), low = s.reduce((a, b) => (b.idx < a.idx ? b : a));
  return { now: last.idx, change7: pct(back(7)), change30: pct(back(30)), high, low, position: high.idx === low.idx ? 50 : Math.round(((last.idx - low.idx) / (high.idx - low.idx)) * 100), start: s[0].idx };
}
