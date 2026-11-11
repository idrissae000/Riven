"use client";

import { useSyncExternalStore } from "react";

/** A once-a-second clock shared by every countdown on the page. Server render and first paint show "…" so they match. */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(cb: () => void) {
  listeners.add(cb);
  timer ??= setInterval(() => listeners.forEach((l) => l()), 1000);
  return () => { listeners.delete(cb); if (!listeners.size && timer) { clearInterval(timer); timer = undefined; } };
}
const snapshot = () => Math.floor(Date.now() / 1000);

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

/** Time left until an ISO timestamp, ticking every second. */
export function Countdown({ to, className = "" }: { to: string; className?: string }) {
  const now = useSyncExternalStore(subscribe, snapshot, () => 0);
  return <span className={`font-mono tabular-nums ${className}`} suppressHydrationWarning>{now === 0 ? "…" : formatRemaining(Date.parse(to) - now * 1000)}</span>;
}
