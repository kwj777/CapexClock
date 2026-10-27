import {
  captchaReducer,
  initialCaptcha,
  sendErrorKind,
  sendErrorMessage,
  sendPlan,
  TURNSTILE_SCRIPT_URL,
  turnstileSiteKey,
  widgetSize,
  type Captcha,
} from "../turnstile";

describe("turnstileSiteKey", () => {
  it("is off when the setting is missing or blank", () => {
    expect(turnstileSiteKey(undefined)).toBeNull();
    expect(turnstileSiteKey("")).toBeNull();
    expect(turnstileSiteKey("   ")).toBeNull();
  });

  it("keeps a key that's set, without stray spaces", () => {
    expect(turnstileSiteKey(" 0x4AAAAAAA ")).toBe("0x4AAAAAAA");
  });
});

it("loads Turnstile for explicit rendering, from Cloudflare", () => {
  const url = new URL(TURNSTILE_SCRIPT_URL);
  expect(url.origin).toBe("https://challenges.cloudflare.com");
  expect(url.searchParams.get("render")).toBe("explicit");
});

describe("widgetSize", () => {
  it("uses the compact widget where the normal one would scroll a phone sideways", () => {
    // A 320px phone has 288px inside the page's 16px margins.
    expect(widgetSize(288)).toBe("compact");
    expect(widgetSize(299)).toBe("compact");
    expect(widgetSize(300)).toBe("flexible");
    expect(widgetSize(448)).toBe("flexible");
  });
});

describe("the CAPTCHA state", () => {
  const off = initialCaptcha(null);
  const loading = initialCaptcha("key");

  it("starts off without a key, and loading with one", () => {
    expect(off).toEqual({ kind: "off" });
    expect(loading).toEqual({ kind: "loading" });
  });

  it("stays off whatever happens", () => {
    expect(captchaReducer(off, { type: "token", token: "t" })).toBe(off);
    expect(captchaReducer(off, { type: "failed" })).toBe(off);
  });

  it("is ready with a token, and waits again once the token is used or expires", () => {
    const waiting = captchaReducer(loading, { type: "cleared" });
    expect(waiting).toEqual({ kind: "waiting" });
    const ready = captchaReducer(waiting, { type: "token", token: "t1" });
    expect(ready).toEqual({ kind: "ready", token: "t1" });
    expect(captchaReducer(ready, { type: "cleared" })).toEqual({ kind: "waiting" });
  });

  it("stays failed when it's reset, and recovers if a token arrives after all", () => {
    const failed = captchaReducer(loading, { type: "failed" });
    expect(failed).toEqual({ kind: "failed" });
    expect(captchaReducer(failed, { type: "cleared" })).toBe(failed);
    expect(captchaReducer(failed, { type: "token", token: "t2" })).toEqual({ kind: "ready", token: "t2" });
  });
});

describe("sendPlan", () => {
  const plan = (state: Captcha) => sendPlan(state);

  it("sends the token when there is one", () => {
    expect(plan({ kind: "ready", token: "abc" })).toEqual({ send: true, token: "abc" });
  });

  it("sends without one when CAPTCHA is off or the check failed, so Supabase decides", () => {
    expect(plan({ kind: "off" })).toEqual({ send: true });
    expect(plan({ kind: "failed" })).toEqual({ send: true });
  });

  it("waits while the check is still running", () => {
    expect(plan({ kind: "loading" })).toEqual({ send: false });
    expect(plan({ kind: "waiting" })).toEqual({ send: false });
  });
});

describe("sendErrorMessage", () => {
  it("says to wait when too many emails went out", () => {
    expect(sendErrorMessage({ status: 429, message: "rate limit" })).toMatch(/^Too many sign-in emails/);
  });

  it("explains a failed security check in plain words", () => {
    const message = sendErrorMessage({
      status: 400,
      code: "captcha_failed",
      message: "captcha protection: request disallowed (no captcha response)",
    });
    expect(message).toMatch(/^The security check didn't pass\./);
    expect(sendErrorMessage({ message: "captcha verification process failed" })).toMatch(/security check/);
  });

  it("says the connection failed instead of blaming the address", () => {
    const offline = { name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" };
    expect(sendErrorMessage(offline)).toBe("We couldn't reach CapexClock just now. Check your connection and try again.");
    expect(sendErrorKind({ message: "Failed to fetch" })).toBe("network");
    expect(sendErrorKind({ name: "AuthRetryableFetchError", status: 504, message: "Gateway Timeout" })).toBe("network");
    expect(sendErrorKind({ message: "NetworkError when attempting to fetch resource." })).toBe("network");
  });

  it("falls back to checking the address", () => {
    expect(sendErrorMessage({ status: 500, message: "Error sending magic link email" })).toMatch(
      /^We couldn't send the link\. Check the address/,
    );
    expect(sendErrorKind({ status: 500, message: "Error sending magic link email" })).toBe("other");
  });
});
