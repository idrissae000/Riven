/** Pure helpers for WFM sign-in responses (kept separate from server-only code so they're unit-tested). */

/** Pulls the session token out of whichever place WFM put it: Authorization header, body, or JWT cookie. */
export function extractToken(headers: Headers, body: unknown): string | null {
  const strip = (v: string) => v.replace(/^(JWT|Bearer)\s+/i, "").trim();
  const header = headers.get("authorization");
  if (header && strip(header) && !/^(JWT|Bearer)$/i.test(header.trim())) return strip(header);

  const data = (body as { data?: Record<string, unknown>; payload?: Record<string, unknown> } | null) ?? {};
  for (const bag of [data.data, data.payload, body as Record<string, unknown> | null]) {
    for (const k of ["token", "accessToken", "access_token", "jwt"]) {
      const v = bag && typeof bag === "object" ? (bag as Record<string, unknown>)[k] : undefined;
      if (typeof v === "string" && v) return strip(v);
    }
  }
  const cookies = headers.getSetCookie?.() ?? [];
  for (const c of cookies) {
    const m = /^JWT=([^;]+)/i.exec(c);
    if (m) return m[1];
  }
  return null;
}

/** WFM errors look like {error:{email:["app.account.email_not_exist"]}} or {error:{request:[...]}}. */
export function flattenErrors(body: unknown): string[] {
  const err = (body as { error?: unknown } | null)?.error;
  if (!err) return [];
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(err);
  return out;
}

const FRIENDLY: [RegExp, string][] = [
  [/email_not_exist|account_not_found|user_not_found/, "No Warframe Market account uses that email."],
  [/password_invalid|password_wrong|invalid_password|wrong_password/, "Wrong password for that Warframe Market account."],
  [/banned/, "That Warframe Market account is banned."],
  [/not_verified|unverified/, "Verify your Warframe Market email first."],
  [/rate|too_many/, "Warframe Market is rate limiting sign-ins. Wait a minute and try again."],
  [/2fa|two_factor/, "This account uses two-factor sign-in, which Riven Buddy doesn’t support yet."],
];

export function friendlyAuthError(codes: string[], status: number): string {
  for (const code of codes) for (const [re, msg] of FRIENDLY) if (re.test(code)) return msg;
  if (status === 429) return FRIENDLY[4][1];
  return codes.length ? `Warframe Market rejected the sign-in (${codes[0]}).` : `Warframe Market sign-in failed (HTTP ${status}).`;
}
