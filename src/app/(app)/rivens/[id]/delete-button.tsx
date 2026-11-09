"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteRivenButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-danger"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Delete this riven?")) return;
        setBusy(true);
        const res = await fetch(`/api/rivens/${id}`, { method: "DELETE" });
        if (res.ok) {
          router.push("/rivens");
          router.refresh();
        } else setBusy(false);
      }}
    >
      Delete
    </button>
  );
}
