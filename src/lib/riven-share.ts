import { rivenInputSchema, type RivenInput } from "@/lib/riven-schema";

/**
 * Unsaved ("guest") rivens live entirely in the URL: /rivens/check?r=<base64url JSON>.
 * No account or database row is needed, and the link is shareable. Isomorphic (browser + server).
 */
export function encodeRiven(r: RivenInput): string {
  const bytes = new TextEncoder().encode(JSON.stringify(r));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeRiven(encoded: string | undefined): RivenInput | null {
  if (!encoded || encoded.length > 4000) return null;
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const parsed = rivenInputSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
