"use client";

import { useState } from "react";
import { Segmented } from "@/components/segmented";

/** Switches between the Prime-part and arcane scanners. Both stay mounted (just hidden) so switching never loses what was scanned. */
export function ScanSwitcher({ prime, arcane }: { prime: React.ReactNode; arcane: React.ReactNode }) {
  const [kind, setKind] = useState<"prime" | "arcane">("prime");
  return (
    <div className="space-y-5">
      <Segmented<"prime" | "arcane"> label="What are you scanning?" value={kind} onChange={setKind} options={[{ value: "prime", label: "Prime parts" }, { value: "arcane", label: "Arcanes" }]} />
      <div hidden={kind !== "prime"}>{prime}</div>
      <div hidden={kind !== "arcane"}>{arcane}</div>
    </div>
  );
}
