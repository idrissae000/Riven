import { describe, expect, it } from "vitest";
import { friendlyAuthError, isExistingAccount } from "./auth-errors";

describe("friendlyAuthError", () => {
  it("explains the email rate limit", () => expect(friendlyAuthError({ code: "over_email_send_rate_limit", message: "email rate limit exceeded" })).toContain("hourly limit"));
  it("explains an unauthorised recipient", () => expect(friendlyAuthError({ code: "email_address_not_authorized", message: "x" })).toContain("isn’t allowed to email"));
  it("explains bad credentials", () => expect(friendlyAuthError({ code: "invalid_credentials", message: "Invalid login credentials" })).toContain("magic link"));
  it("falls back to the original message", () => expect(friendlyAuthError({ code: "other", message: "Something else" })).toBe("Something else"));
});

describe("isExistingAccount", () => {
  it("is true for the empty-identities user Supabase returns for a registered email", () => expect(isExistingAccount({ identities: [] })).toBe(true));
  it("is false for a new user", () => expect(isExistingAccount({ identities: [{}] })).toBe(false));
  it("is false when there's no user or no identities field", () => { expect(isExistingAccount(null)).toBe(false); expect(isExistingAccount({})).toBe(false); });
});
