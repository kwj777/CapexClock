import { hasSignInCookie } from "../AccountLink";

describe("hasSignInCookie", () => {
  it("finds the Supabase sign-in cookie, whole or split into chunks", () => {
    expect(hasSignInCookie("sb-abc-auth-token=base64-xyz")).toBe(true);
    expect(hasSignInCookie("ph_phc_abc_posthog=1; sb-abc-auth-token.0=base64-xyz; sb-abc-auth-token.1=more")).toBe(true);
    expect(hasSignInCookie("sb-127-auth-token=x")).toBe(true);
  });

  it("ignores other cookies and an emptied one", () => {
    expect(hasSignInCookie("")).toBe(false);
    expect(hasSignInCookie("ph_phc_abc_posthog=1")).toBe(false);
    expect(hasSignInCookie("sb-abc-auth-token-code-verifier=x")).toBe(false);
    expect(hasSignInCookie("sb-abc-auth-token=; other=1")).toBe(false);
  });
});
