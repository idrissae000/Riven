import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { wfmRequest } from "./client";
import { extractToken, flattenErrors, friendlyAuthError } from "./auth-parse";
import { decryptToken, encryptToken, jwtExpiry } from "./crypto";

export class WfmAuthError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
/** The stored session is missing, expired or was rejected: the user must sign in again. */
export class ReauthRequired extends Error {
  constructor(message = "Your Warframe Market session expired — sign in again.") { super(message); }
}

export interface WfmSessionInfo { connected: boolean; name: string | null; slug: string | null; expiresAt: string | null; since: string | null }

interface SignedIn { token: string; name: string | null; slug: string | null }

function userFrom(body: unknown): { name: string | null; slug: string | null } {
  const b = body as { payload?: { user?: Record<string, string> }; data?: { user?: Record<string, string> } & Record<string, string> } | null;
  const u = b?.payload?.user ?? b?.data?.user ?? b?.data;
  return { name: u?.ingame_name ?? u?.ingameName ?? null, slug: u?.slug ?? null };
}

/**
 * Exchanges the user's WFM email+password for a session token. The password is used for
 * this one request and is never logged, stored or returned.
 *
 * v1 is used because riven auctions (and so listing) only exist in v1. If WFM retires the
 * v1 route we fall back to the v2 endpoint, which additionally wants a deviceId/clientId.
 * (v2's success response shape could not be verified without a real account, so the token
 * extraction is deliberately tolerant — see extractToken.)
 */
export async function signIn(email: string, password: string): Promise<SignedIn> {
  const v1 = await wfmRequest("/v1/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "JWT" },
    body: JSON.stringify({ email, password, auth_type: "header" }),
  });
  let res = v1;
  if ([404, 405, 410].includes(v1.status)) {
    res = await wfmRequest("/v2/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, deviceId: randomUUID(), clientId: "riven-buddy" }),
    });
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new WfmAuthError(friendlyAuthError(flattenErrors(body), res.status), res.status === 429 ? 429 : 401);
  const token = extractToken(res.headers, body);
  if (!token) throw new WfmAuthError("Signed in, but Warframe Market didn’t return a session token.", 502);
  return { token, ...userFrom(body) };
}

// --- encrypted session store (service role only) --------------------------------------

export async function saveSession(userId: string, s: SignedIn): Promise<void> {
  const { error } = await createAdminClient().from("wfm_sessions").upsert({
    user_id: userId,
    token_enc: encryptToken(s.token, userId),
    wfm_name: s.name,
    wfm_slug: s.slug,
    expires_at: jwtExpiry(s.token)?.toISOString() ?? null,
    created_at: new Date().toISOString(),
    last_used_at: null,
  });
  if (error) throw new Error(`Could not store session: ${error.message}`);
}

export async function clearSession(userId: string): Promise<void> {
  await createAdminClient().from("wfm_sessions").delete().eq("user_id", userId);
}

/** Status for the UI — never includes the token. */
export async function sessionInfo(userId: string): Promise<WfmSessionInfo> {
  const none = { connected: false, name: null, slug: null, expiresAt: null, since: null };
  const { data } = await createAdminClient().from("wfm_sessions").select("wfm_name,wfm_slug,expires_at,created_at").eq("user_id", userId).maybeSingle();
  if (!data) return none;
  if (data.expires_at && Date.parse(data.expires_at) <= Date.now()) return none; // expired == not connected
  return { connected: true, name: data.wfm_name, slug: data.wfm_slug, expiresAt: data.expires_at, since: data.created_at };
}

async function loadToken(userId: string): Promise<string> {
  const { data } = await createAdminClient().from("wfm_sessions").select("token_enc,expires_at").eq("user_id", userId).maybeSingle();
  if (!data) throw new ReauthRequired("Connect your Warframe Market account first.");
  if (data.expires_at && Date.parse(data.expires_at) <= Date.now()) {
    await clearSession(userId);
    throw new ReauthRequired();
  }
  try {
    return decryptToken(data.token_enc, userId);
  } catch {
    await clearSession(userId); // unreadable (e.g. key rotated): make the user re-auth
    throw new ReauthRequired();
  }
}

/** Authenticated, throttled WFM request. A 401 means the token died: drop it and ask for re-auth. */
export async function wfmAuthed(userId: string, path: string, init: RequestInit = {}): Promise<Response> {
  const token = await loadToken(userId);
  const res = await wfmRequest(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers as Record<string, string> | undefined), Authorization: `JWT ${token}` },
  });
  if (res.status === 401) {
    await clearSession(userId);
    throw new ReauthRequired();
  }
  void createAdminClient().from("wfm_sessions").update({ last_used_at: new Date().toISOString() }).eq("user_id", userId);
  return res;
}

export const wfmConfigured = () => !!process.env.WFM_TOKEN_ENCRYPTION_KEY && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
