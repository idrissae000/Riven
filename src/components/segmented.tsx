"use client";

/** A small pill switch for choosing one of a few views (used for tabs and quick splits). */
export function Segmented<T extends string>({ value, onChange, options, label, size = "md" }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string; size?: "sm" | "md";
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full gap-1 overflow-x-auto border border-line bg-panel-2/60 p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} role="tab" aria-selected={on} onClick={() => onChange(o.value)}
            className={`whitespace-nowrap font-display font-semibold uppercase transition-colors ${size === "sm" ? "px-2 py-1 text-[0.64rem] sm:px-2.5 sm:text-[0.66rem]" : "px-2.5 py-1.5 text-[0.68rem] tracking-[0.08em] sm:px-3.5 sm:text-xs sm:tracking-[0.12em]"} ${on ? "bg-gold/15 text-gold" : "text-dim hover:text-ink"}`}>
            {o.label}{o.count != null && <span className={`ml-1.5 font-mono text-[0.65rem] ${on ? "text-gold/80" : "text-dim/70"}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
