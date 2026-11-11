/** A collapsed "how this works" note, so explanations don't sit on screen all the time. */
export function About({ children, label = "How this works" }: { children: React.ReactNode; label?: string }) {
  return (
    <details className="text-xs text-dim">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-gold/90 hover:text-ink">ⓘ {label}</summary>
      <div className="mt-1.5 leading-relaxed">{children}</div>
    </details>
  );
}
