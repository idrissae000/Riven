"use client";

/**
 * Tucks a list's filter controls behind one toggle so the page opens calm. `active` is how many filters are set
 * (shown as a badge so you can tell at a glance that the list is narrowed).
 */
export function Filters({ active = 0, summary = "Filters & sort", children }: { active?: number; summary?: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-line pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-display text-xs font-semibold uppercase tracking-[0.1em] text-gold hover:text-ink">
        <span>{summary}{active > 0 && <span className="ml-2 bg-gold/20 px-1.5 py-0.5 text-xs text-gold">{active} on</span>}</span>
        <span aria-hidden className="text-dim transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}
