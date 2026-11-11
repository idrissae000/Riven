"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Keeps market prices current (arcanes, Prime parts, …): while any are out of date it asks the server to refresh a few at a time (the server
 * throttles Warframe Market calls and only touches stale rows), reloads the page data as results land, and stops
 * when everything is fresh or Warframe Market pushes back. Renders nothing when there's nothing to do.
 */
export function PriceRefresher({ due, endpoint = "/api/arcanes/prices/refresh" }: { due: number; endpoint?: string }) {
  const router = useRouter();
  const [left, setLeft] = useState(due);
  const [state, setState] = useState<"running" | "done" | "limited" | "error">("running");

  useEffect(() => {
    if (due <= 0) return;
    let alive = true;
    (async () => {
      let busy = 0;
      for (let i = 0; i < 150 && alive; i++) {
        let j: { busy?: boolean; rateLimited?: boolean; remaining?: number | { prices: number; stats: number } };
        try {
          const res = await fetch(endpoint, { method: "POST" });
          if (!res.ok) throw new Error(String(res.status));
          j = await res.json();
        } catch { if (alive) setState("error"); return; }
        if (!alive) return;
        if (j.busy) { if (++busy > 10) { setState("error"); return; } await sleep(3000); continue; }
        const remaining = typeof j.remaining === "number" ? j.remaining : (j.remaining?.prices ?? 0) + (j.remaining?.stats ?? 0);
        setLeft(remaining);
        const finished = remaining === 0 || !!j.rateLimited;
        if (finished || i % 3 === 2) router.refresh();
        if (j.rateLimited) { setState("limited"); return; }
        if (remaining === 0) { setState("done"); return; }
      }
    })();
    return () => { alive = false; };
  }, [due, router, endpoint]);

  if (due <= 0 || state === "done") return null;
  return (
    <p className="text-xs text-dim" role="status" aria-live="polite">
      {state === "running" && `Updating prices from Warframe Market… ${left} to go`}
      {state === "limited" && "Warframe Market asked us to slow down — the rest will update next time."}
      {state === "error" && "Couldn’t update every price just now; showing the latest we have."}
    </p>
  );
}
