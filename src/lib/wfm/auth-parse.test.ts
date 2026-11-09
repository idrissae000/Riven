import { describe, expect, it } from "vitest";
import { extractToken, flattenErrors, friendlyAuthError } from "./auth-parse";

describe("extractToken", () => {
  it("reads the Authorization header (JWT or Bearer prefix)", () => {
    expect(extractToken(new Headers({ authorization: "JWT abc.def.ghi" }), null)).toBe("abc.def.ghi");
    expect(extractToken(new Headers({ authorization: "Bearer xyz" }), null)).toBe("xyz");
  });
  it("ignores a bare scheme with no token", () => expect(extractToken(new Headers({ authorization: "JWT" }), null)).toBeNull());
  it("falls back to body fields", () => {
    expect(extractToken(new Headers(), { data: { token: "t1" } })).toBe("t1");
    expect(extractToken(new Headers(), { payload: { accessToken: "t2" } })).toBe("t2");
  });
  it("falls back to the JWT cookie", () => {
    const h = new Headers();
    h.append("set-cookie", "JWT=cookie.tok.en; Path=/; HttpOnly");
    expect(extractToken(h, {})).toBe("cookie.tok.en");
  });
  it("returns null when there is nothing", () => expect(extractToken(new Headers(), { data: {} })).toBeNull());
});

describe("errors", () => {
  it("flattens nested WFM error shapes", () => {
    expect(flattenErrors({ error: { email: ["app.account.email_not_exist"] } })).toEqual(["app.account.email_not_exist"]);
    expect(flattenErrors({ error: { inputs: { deviceId: "app.field.required" } } })).toEqual(["app.field.required"]);
    expect(flattenErrors({})).toEqual([]);
  });
  it("maps known codes to friendly text and never echoes unknown input", () => {
    expect(friendlyAuthError(["app.account.email_not_exist"], 400)).toMatch(/No Warframe Market account/);
    expect(friendlyAuthError(["app.account.password_invalid"], 400)).toMatch(/Wrong password/);
    expect(friendlyAuthError([], 500)).toMatch(/HTTP 500/);
    expect(friendlyAuthError(["weird.code"], 400)).toContain("weird.code");
  });
});
