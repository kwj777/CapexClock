import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { reportSignup, signupBody, SOURCE_WINDOW_MS } from "../gosocially";

const NOW = Date.parse("2026-11-27T12:00:00Z");
const base = { userId: "u-1", firstSignInAt: "2026-11-26T12:00:00Z", cameFrom: { utm_source: "gosocially", utm_content: "linkedin" } };

describe("signupBody", () => {
  it("sends the id, first sign-in and tags for a new account", () => {
    expect(signupBody(base, NOW)).toEqual({ id: "u-1", occurred_at: "2026-11-26T12:00:00.000Z", utm_source: "gosocially", utm_content: "linkedin" });
  });

  it("leaves the tags off an older account, which today's visit didn't bring", () => {
    const old = { ...base, firstSignInAt: new Date(NOW - SOURCE_WINDOW_MS - 1).toISOString() };
    expect(signupBody(old, NOW)).toEqual({ id: "u-1", occurred_at: old.firstSignInAt });
  });

  it("sends a test account as a test", () => {
    expect(signupBody({ ...base, tester: true }, NOW)).toEqual({ id: "u-1", tester: true });
  });
});

describe("reportSignup", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("sends nothing without a key", async () => {
    const fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock;
    expect(await reportSignup(base, "")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts with the key and never throws", async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 201 }));
    global.fetch = fetchMock;
    expect(await reportSignup(base, "k".repeat(40))).toBe(true);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${"k".repeat(40)}`);
    global.fetch = jest.fn<typeof fetch>().mockRejectedValue(new TypeError("offline"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    expect(await reportSignup(base, "k".repeat(40))).toBe(false);
  });
});
