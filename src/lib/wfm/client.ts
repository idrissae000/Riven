import "server-only";
import { Throttle } from "./throttle";
import { cached, type Cached } from "./cache";

const HOST = "https://api.warframe.market";
export const WFM_USER_AGENT = "WarframeEconomist/0.1 (personal tool)";

/** One shared limiter for every outbound WFM call from this server instance. */
export const wfmThrottle = new Throttle(350);

export class WfmError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export function wfmHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { Accept: "application/json", Language: "en", Platform: "pc", "User-Agent": WFM_USER_AGENT, ...extra };
}

/** Throttled request. GETs get one retry on 429/5xx (never POST/DELETE: a retry could double-post). Not cached — use wfmGet for reads. */
export async function wfmRequest(path: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await wfmThrottle.schedule(() =>
      fetch(HOST + path, {
        ...init,
        headers: wfmHeaders(init.headers as Record<string, string> | undefined),
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      }),
    );
    const idempotent = !init.method || init.method.toUpperCase() === "GET";
    if (idempotent && (res.status === 429 || res.status >= 500) && attempt < 1) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await new Promise((r) => setTimeout(r, Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1500, 5000)));
      continue;
    }
    return res;
  }
}

/** Throttled + cached JSON GET. `path` includes the version, e.g. "/v2/items" or "/v1/auctions/search?...". */
export function wfmGet<T>(
  path: string,
  opts: { ttlMs?: number; force?: boolean; minRefreshAgeMs?: number } = {},
): Promise<Cached<T>> {
  return cached<T>(
    path,
    async () => {
      const res = await wfmRequest(path);
      if (!res.ok) throw new WfmError(`Warframe Market ${res.status} for ${path.split("?")[0]}`, res.status);
      return (await res.json()) as T;
    },
    opts,
  );
}
