import { isFirstSignIn, WELCOMED_KEY } from "../welcome";

const NOW = Date.parse("2026-09-28T12:00:00Z");
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const ago = (ms: number) => new Date(NOW - ms).toISOString();

function user(confirmedAgoMs: number, metadata: Record<string, unknown> = {}, createdAgoMs = confirmedAgoMs) {
  return { created_at: ago(createdAgoMs), email_confirmed_at: ago(confirmedAgoMs), user_metadata: metadata };
}

describe("isFirstSignIn", () => {
  it("is true for a new account that hasn't been welcomed", () => {
    expect(isFirstSignIn(user(30 * 1000), NOW)).toBe(true);
  });

  it("is still true when the first link was opened in another browser and the next one minutes later", () => {
    // The email was confirmed long before this sign-in, which the old 60-second check missed.
    expect(isFirstSignIn(user(10 * MINUTE), NOW)).toBe(true);
    expect(isFirstSignIn(user(3 * DAY), NOW)).toBe(true);
  });

  it("is true when the account was made by a link requested long ago that was never opened", () => {
    // Supabase makes the account on the first request, not when a link is opened.
    expect(isFirstSignIn(user(5 * 1000, {}, 30 * DAY), NOW)).toBe(true);
    expect(isFirstSignIn(user(2 * DAY, {}, 400 * DAY), NOW)).toBe(true);
  });

  it("is false once the account has been welcomed, however soon the next sign-in is", () => {
    expect(isFirstSignIn(user(45 * 1000, { [WELCOMED_KEY]: "2026-09-28T11:59:30Z" }), NOW)).toBe(false);
  });

  it("is false for accounts made before the flag existed", () => {
    expect(isFirstSignIn(user(8 * DAY), NOW)).toBe(false);
    expect(isFirstSignIn(user(8 * DAY, {}, 20 * DAY), NOW)).toBe(false);
  });

  it("falls back to the creation time when the confirmation time is missing", () => {
    expect(isFirstSignIn({ created_at: ago(MINUTE) }, NOW)).toBe(true);
    expect(isFirstSignIn({ created_at: ago(MINUTE), email_confirmed_at: null }, NOW)).toBe(true);
    expect(isFirstSignIn({ created_at: ago(8 * DAY), email_confirmed_at: "" }, NOW)).toBe(false);
  });

  it("is false for a missing or unreadable time", () => {
    expect(isFirstSignIn({ created_at: "" }, NOW)).toBe(false);
    expect(isFirstSignIn({ created_at: "not a date", user_metadata: null }, NOW)).toBe(false);
    expect(isFirstSignIn({ created_at: ago(MINUTE), email_confirmed_at: "not a date" }, NOW)).toBe(false);
  });
});
