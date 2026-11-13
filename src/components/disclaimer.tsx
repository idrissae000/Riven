/** Shown on every page: this is a fan tool, not an official Warframe / Digital Extremes product. */
export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-dim ${className}`}>
      Warframe Economist is an unofficial fan-made tool. It is not affiliated with, endorsed by or sponsored by Digital Extremes. Warframe and all related names, marks and imagery are trademarks of Digital Extremes Ltd. Market data comes from Warframe Market, which is also an independent community site.
    </p>
  );
}
