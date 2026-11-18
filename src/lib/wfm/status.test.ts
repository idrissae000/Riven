import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./auth", () => ({ sessionToken: async () => "tok", wfmAuthedV2: async () => ({ ok: true, json: async () => ({ data: { status: "ingame" } }) }) }));
vi.mock("./client", () => ({ WFM_USER_AGENT: "test" }));

import { parseStatus, setStatus, setStatusMessage, signInMessage, type SocketFactory } from "./status";

describe("parseStatus", () => {
  it("reads it however it is nested or spelled", () => {
    expect(parseStatus({ data: { status: "ingame" } })).toBe("ingame");
    expect(parseStatus({ data: { user: { status: "Online" } } })).toBe("online");
    expect(parseStatus({ data: { status: "in_game" } })).toBe("ingame");
    expect(parseStatus({ data: { status: "invisible" } })).toBe("invisible");
    expect(parseStatus({ data: { status: "offline" } })).toBe("offline");
  });
  it("returns null when it cannot tell", () => {
    expect(parseStatus({ data: {} })).toBeNull();
    expect(parseStatus(null)).toBeNull();
    expect(parseStatus({ data: { status: 5 } })).toBeNull();
  });
});

describe("messages", () => {
  it("builds the sign-in and set-status commands", () => {
    expect(JSON.parse(signInMessage("tok"))).toMatchObject({ route: "@wfm|cmd/auth/signIn", payload: { token: "tok" } });
    expect(JSON.parse(setStatusMessage("ingame", 3600))).toMatchObject({ route: "@wfm|cmd/status/set", payload: { status: "ingame", duration: 3600 } });
    expect(JSON.parse(setStatusMessage("online")).payload).toEqual({ status: "online" });
  });
});

/** A fake socket that answers like the server: sign-in ok, then echoes the status event. */
function fakeSocket(script: (send: (route: string, payload?: unknown) => void, got: { route: string; payload?: unknown }) => void) {
  const handlers: Record<string, ((...a: unknown[]) => void)[]> = {};
  const sent: { route: string; payload?: unknown }[] = [];
  const sock = {
    on: (e: string, f: (...a: unknown[]) => void) => { (handlers[e] ??= []).push(f); return sock; },
    once: (e: string, f: (...a: unknown[]) => void) => { (handlers[e] ??= []).push(f); return sock; },
    send: (s: string) => { const m = JSON.parse(s); sent.push(m); queueMicrotask(() => script((route, payload) => handlers.message?.forEach((h) => h(JSON.stringify({ route, payload }))), m)); },
    close: () => {},
  };
  queueMicrotask(() => handlers.open?.forEach((h) => h()));
  return { sock: sock as never, sent };
}

describe("setStatus", () => {
  it("signs in, sets the status and finishes on the confirmation", async () => {
    let sent: { route: string; payload?: unknown }[] = [];
    const factory: SocketFactory = () => { const f = fakeSocket((reply, got) => { if (got.route.endsWith("auth/signIn")) reply("@wfm|cmd/auth/signIn:ok"); else reply("@wfm|event/status/set", { status: "ingame" }); }); sent = f.sent; return f.sock; };
    await expect(setStatus("u", "ingame", 3600, factory)).resolves.toBeUndefined();
    expect(sent.map((m) => m.route)).toEqual(["@wfm|cmd/auth/signIn", "@wfm|cmd/status/set"]);
    expect(sent[1].payload).toEqual({ status: "ingame", duration: 3600 });
  });
  it("fails clearly when the session is refused", async () => {
    const factory: SocketFactory = () => fakeSocket((reply) => reply("@wfm|cmd/auth/signIn:error", { message: "bad" })).sock;
    await expect(setStatus("u", "online", undefined, factory)).rejects.toThrow(/saved session/);
  });
});
