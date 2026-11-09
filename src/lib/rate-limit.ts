/**
 * Fixed-window, in-memory rate limiter. BEST-EFFORT: each serverless instance keeps its own counters, so
 * this blunts casual abuse but is not a hard guarantee. Pair it with a monthly spend limit on the
 * Anthropic key (Console -> Limits) for a real ceiling.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  if (windows.size > 5000) for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  if (w.count >= limit) return { ok: false, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
  w.count++;
  return { ok: true, retryAfterSec: 0 };
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}
