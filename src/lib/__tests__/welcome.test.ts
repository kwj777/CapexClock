import { isFirstSignIn, WELCOMED_KEY } from "../welcome";

const NOW = Date.parse("2026-09-28T12:00:00Z");
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function user(createdAgoMs: number, metadata: Record<string, unknown> = {}) {
  return { created_at: new Date(NOW - createdAgoMs).toISOString(), user_metadata: metadata };
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

  it("is false once the account has been welcomed, however soon the next sign-in is", () => {
    expect(isFirstSignIn(user(45 * 1000, { [WELCOMED_KEY]: "2026-09-28T11:59:30Z" }), NOW)).toBe(false);
  });

  it("is false for accounts made before the flag existed", () => {
    expect(isFirstSignIn(user(8 * DAY), NOW)).toBe(false);
  });

  it("is false for a missing or unreadable creation time", () => {
    expect(isFirstSignIn({ created_at: "" }, NOW)).toBe(false);
    expect(isFirstSignIn({ created_at: "not a date", user_metadata: null }, NOW)).toBe(false);
  });
});
