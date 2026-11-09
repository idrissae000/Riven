import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serviceRoleKey } from "@/lib/env";

/** Default TTL for market data: 12 minutes (spec: 10–15). */
export const DEFAULT_TTL_MS = 12 * 60 * 1000;

interface Entry<T = unknown> { payload: T; fetchedAt: number; expiresAt: number }

const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export interface Cached<T> { data: T; fetchedAt: string; fromCache: boolean; stale: boolean }

async function dbGet(key: string): Promise<Entry | null> {
  if (!serviceRoleKey()) return null;
  try {
    const { data } = await createAdminClient().from("market_cache").select("payload,fetched_at,expires_at").eq("key", key).maybeSingle();
    if (!data) return null;
    return { payload: data.payload, fetchedAt: Date.parse(data.fetched_at), expiresAt: Date.parse(data.expires_at) };
  } catch {
    return null;
  }
}

async function dbSet(key: string, e: Entry): Promise<void> {
  if (!serviceRoleKey()) return;
  try {
    await createAdminClient().from("market_cache").upsert({
      key, payload: e.payload, fetched_at: new Date(e.fetchedAt).toISOString(), expires_at: new Date(e.expiresAt).toISOString(),
    });
  } catch {
    /* cache is best-effort */
  }
}

/**
 * Read-through cache: memory -> Supabase -> loader. Concurrent callers for the same
 * key share one load. If the loader fails and an expired entry exists, that stale
 * entry is served (flagged `stale`) rather than erroring.
 *
 * `minRefreshAgeMs`: when set, a cached entry younger than this is returned even if
 * `force` is true, so a "refresh" button can never hammer the upstream API.
 */
export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  opts: { ttlMs?: number; force?: boolean; minRefreshAgeMs?: number } = {},
): Promise<Cached<T>> {
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();
  let entry = memory.get(key) ?? (await dbGet(key));
  if (entry) memory.set(key, entry);

  if (entry) {
    const fresh = entry.expiresAt > now;
    const tooYoungToRefresh = opts.minRefreshAgeMs !== undefined && now - entry.fetchedAt < opts.minRefreshAgeMs;
    if ((fresh && !opts.force) || tooYoungToRefresh) {
      return { data: entry.payload as T, fetchedAt: new Date(entry.fetchedAt).toISOString(), fromCache: true, stale: false };
    }
  }

  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = loader().finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  try {
    const data = await p;
    entry = { payload: data, fetchedAt: Date.now(), expiresAt: Date.now() + ttl };
    memory.set(key, entry);
    void dbSet(key, entry);
    return { data, fetchedAt: new Date(entry.fetchedAt).toISOString(), fromCache: false, stale: false };
  } catch (err) {
    if (entry) return { data: entry.payload as T, fetchedAt: new Date(entry.fetchedAt).toISOString(), fromCache: true, stale: true };
    throw err;
  }
}
