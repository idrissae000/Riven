import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM envelope for WFM session tokens.
 * Format:  v1.<iv>.<tag>.<ciphertext>   (base64url parts)
 * The user id is bound as AAD so a ciphertext copied to another user's row won't decrypt.
 */
const VERSION = "v1";

function keyFrom(secret: string | undefined): Buffer {
  if (!secret) throw new Error("WFM_TOKEN_ENCRYPTION_KEY is not set (generate one with: openssl rand -base64 32)");
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) throw new Error("WFM_TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64-encoded");
  return key;
}

export function encryptToken(plaintext: string, userId: string, secret = process.env.WFM_TOKEN_ENCRYPTION_KEY): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  cipher.setAAD(Buffer.from(userId));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptToken(envelope: string, userId: string, secret = process.env.WFM_TOKEN_ENCRYPTION_KEY): string {
  const [v, iv, tag, ct] = envelope.split(".");
  if (v !== VERSION || !iv || !tag || !ct) throw new Error("Unrecognised token envelope");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

/** Reads the `exp` claim of a JWT WITHOUT verifying it (we only use it to know when to ask for re-auth). */
export function jwtExpiry(token: string): Date | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? new Date(payload.exp * 1000) : null;
  } catch {
    return null;
  }
}
