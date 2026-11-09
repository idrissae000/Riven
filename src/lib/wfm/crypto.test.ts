import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptToken, encryptToken, jwtExpiry } from "./crypto";

const key = randomBytes(32).toString("base64");
const user = "11111111-1111-1111-1111-111111111111";

describe("token encryption", () => {
  it("round-trips and never contains the plaintext", () => {
    const env = encryptToken("eyJ.secret.token", user, key);
    expect(env).not.toContain("secret");
    expect(env.startsWith("v1.")).toBe(true);
    expect(decryptToken(env, user, key)).toBe("eyJ.secret.token");
  });
  it("uses a fresh IV each time", () => {
    expect(encryptToken("x", user, key)).not.toBe(encryptToken("x", user, key));
  });
  it("is bound to the user (AAD) and detects tampering / wrong key", () => {
    const env = encryptToken("tok", user, key);
    expect(() => decryptToken(env, "22222222-2222-2222-2222-222222222222", key)).toThrow();
    const parts = env.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptToken(parts.join("."), user, key)).toThrow();
    expect(() => decryptToken(env, user, randomBytes(32).toString("base64"))).toThrow();
  });
  it("refuses to run without a proper 32-byte key", () => {
    expect(() => encryptToken("x", user, undefined)).toThrow(/not set/);
    expect(() => encryptToken("x", user, Buffer.from("short").toString("base64"))).toThrow(/32/);
  });
});

describe("jwtExpiry", () => {
  const mk = (p: object) => `h.${Buffer.from(JSON.stringify(p)).toString("base64url")}.s`;
  it("reads exp", () => expect(jwtExpiry(mk({ exp: 1799426799 }))?.toISOString()).toBe("2027-01-08T16:46:39.000Z"));
  it("returns null for junk", () => { expect(jwtExpiry("nope")).toBeNull(); expect(jwtExpiry(mk({}))).toBeNull(); });
});
