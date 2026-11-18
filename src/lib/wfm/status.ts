import "server-only";
import WebSocket from "ws";
import { randomBytes } from "node:crypto";
import { sessionToken, wfmAuthedV2 } from "./auth";
import { WFM_USER_AGENT } from "./client";

export type WfmStatus = "invisible" | "online" | "ingame";
export const STATUSES: WfmStatus[] = ["invisible", "online", "ingame"];
const WS_URL = "wss://ws.warframe.market/socket";
const WS_PROTOCOL = "wfm";

/** The status in a /v2/me answer, whichever way it is nested. Null when it can't be read (the caller must treat that as "don't know"). */
export function parseStatus(body: unknown): WfmStatus | "offline" | null {
  const b = body as { data?: Record<string, unknown> & { user?: Record<string, unknown> } } | null;
  const raw = b?.data?.status ?? b?.data?.user?.status;
  if (typeof raw !== "string") return null;
  const v = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (v === "ingame") return "ingame";
  if (v === "online") return "online";
  if (v === "invisible") return "invisible";
  if (v === "offline") return "offline";
  return null;
}

/** The WebSocket messages, in the form Warframe Market's own site and community clients use. */
export const wsMessage = (route: string, payload?: unknown) => JSON.stringify({ route, ...(payload === undefined ? {} : { payload }), id: randomBytes(8).toString("base64url").slice(0, 11) });
export const signInMessage = (token: string) => wsMessage("@wfm|cmd/auth/signIn", { token });
export const setStatusMessage = (status: WfmStatus, durationSec?: number) => wsMessage("@wfm|cmd/status/set", { status, ...(durationSec ? { duration: durationSec } : {}) });

/** The user's current status on Warframe Market, or null if it couldn't be read. */
export async function readStatus(userId: string): Promise<WfmStatus | "offline" | null> {
  try {
    const res = await wfmAuthedV2(userId, "/v2/me");
    if (!res.ok) return null;
    return parseStatus(await res.json().catch(() => null));
  } catch { return null; }
}

export class StatusError extends Error {}

type Sock = Pick<WebSocket, "on" | "send" | "close" | "once">;
export type SocketFactory = (url: string, protocol: string, headers: Record<string, string>) => Sock;
const realSocket: SocketFactory = (url, protocol, headers) => new WebSocket(url, protocol, { headers, handshakeTimeout: 8000 });

/**
 * Sets the user's status: opens a short WebSocket, signs in with their session, sends the status (optionally for `durationSec` seconds), waits for the
 * confirmation and closes. Warframe Market keeps the status after the socket closes. The token never leaves the server.
 */
export async function setStatus(userId: string, status: WfmStatus, durationSec?: number, factory: SocketFactory = realSocket): Promise<void> {
  const token = await sessionToken(userId);
  await new Promise<void>((resolve, reject) => {
    const ws = factory(WS_URL, WS_PROTOCOL, { "User-Agent": WFM_USER_AGENT });
    let signedIn = false, done = false;
    const finish = (err?: Error) => { if (done) return; done = true; clearTimeout(timer); try { ws.close(); } catch { /* already closed */ } if (err) reject(err); else resolve(); };
    const timer = setTimeout(() => finish(new StatusError(signedIn ? "Warframe Market didn’t confirm the change in time." : "Couldn’t sign in to Warframe Market’s status service in time.")), 10_000);
    ws.on("open", () => ws.send(signInMessage(token)));
    ws.on("error", () => finish(new StatusError("Couldn’t reach Warframe Market’s status service.")));
    ws.on("close", () => finish(new StatusError("Warframe Market closed the connection before confirming.")));
    ws.on("message", (raw: unknown) => {
      let m: { route?: string; payload?: { status?: string; message?: string; error?: string } } | null = null;
      try { m = JSON.parse(String(raw)); } catch { return; }
      const route = m?.route ?? "";
      if (route.startsWith("@wfm|cmd/auth/signIn")) {
        if (route.endsWith(":ok")) { signedIn = true; ws.send(setStatusMessage(status, durationSec)); }
        else if (route.endsWith(":error")) finish(new StatusError("Warframe Market didn’t accept your saved session. Disconnect and sign in again."));
      } else if (route.startsWith("@wfm|event/status/set") || route.startsWith("@wfm|cmd/status/set")) {
        if (route.endsWith(":error")) finish(new StatusError(m?.payload?.message ?? m?.payload?.error ?? "Warframe Market refused that status."));
        else finish();
      }
    });
  });
}
