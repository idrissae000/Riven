/** Page title block: gold kicker label above a big display title, actions on the right. */
export function PageHeader({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="space-y-2">
      <p className="kicker">{kicker}</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="h-display text-[2rem] sm:text-4xl">{title}</h1>
        {children}
      </div>
    </header>
  );
}
