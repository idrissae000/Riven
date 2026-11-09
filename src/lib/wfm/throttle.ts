/**
 * Serialises async tasks and guarantees at least `minIntervalMs` between task
 * *starts*. Warframe Market allows 3 requests/second; we default to one request
 * per 350ms (~2.85/s) to stay safely under it.
 *
 * NOTE: this limiter is per server instance. On Vercel, concurrent lambdas each
 * have their own — the shared Supabase cache (see cache.ts) is what keeps the
 * combined request volume low. For a single-user tool this is ample.
 */
export class Throttle {
  private chain: Promise<unknown> = Promise.resolve();
  private lastStart = 0;

  constructor(private readonly minIntervalMs: number) {}

  schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = async () => {
      const wait = this.lastStart + this.minIntervalMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastStart = Date.now();
      return task();
    };
    const result = this.chain.then(run, run);
    this.chain = result.catch(() => undefined);
    return result;
  }
}
