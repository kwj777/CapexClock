import {
  DEFAULT_SWITCHES,
  isUnsubscribeKind,
  ONE_CLICK_PATH,
  readUnsubscribeLink,
  switchesFrom,
  unsubscribedText,
  unsubscribeUrl,
} from "../kinds";

const TOKEN = "3f1c2b8e-9d4a-4c6b-8e2f-0a1b2c3d4e5f";

describe("readUnsubscribeLink", () => {
  it("reads a token and one kind", () => {
    expect(readUnsubscribeLink(TOKEN, "reminders")).toEqual({ token: TOKEN, kind: "reminders" });
    expect(readUnsubscribeLink(TOKEN, "all")).toEqual({ token: TOKEN, kind: "all" });
  });

  it("treats a missing kind as all three", () => {
    expect(readUnsubscribeLink(TOKEN, undefined)).toEqual({ token: TOKEN, kind: "all" });
    expect(readUnsubscribeLink(TOKEN, "")).toEqual({ token: TOKEN, kind: "all" });
  });

  it("lowercases the token", () => {
    expect(readUnsubscribeLink(TOKEN.toUpperCase(), "all")?.token).toBe(TOKEN);
  });

  it("refuses broken links", () => {
    expect(readUnsubscribeLink(undefined, "all")).toBeNull();
    expect(readUnsubscribeLink("not-a-token", "all")).toBeNull();
    expect(readUnsubscribeLink([TOKEN, TOKEN], "all")).toBeNull();
    expect(readUnsubscribeLink(TOKEN, "everything")).toBeNull();
    expect(readUnsubscribeLink(TOKEN, ["reminders"])).toBeNull();
  });
});

describe("unsubscribeUrl", () => {
  it("round-trips through readUnsubscribeLink", () => {
    const url = new URL(unsubscribeUrl("https://capexclock.com", TOKEN, "budget_summary"));
    expect(url.origin + url.pathname).toBe("https://capexclock.com/email/unsubscribe");
    expect(readUnsubscribeLink(url.searchParams.get("t"), url.searchParams.get("k"))).toEqual({
      token: TOKEN,
      kind: "budget_summary",
    });
  });

  it("builds the one-click address", () => {
    expect(unsubscribeUrl("https://capexclock.com", TOKEN, "all", ONE_CLICK_PATH)).toBe(
      `https://capexclock.com/email/unsubscribe/one-click?t=${TOKEN}&k=all`,
    );
  });
});

describe("switchesFrom", () => {
  it("is all on without a row", () => {
    expect(switchesFrom(null)).toEqual(DEFAULT_SWITCHES);
    expect(Object.values(DEFAULT_SWITCHES)).toEqual([true, true, true]);
  });

  it("keeps a row's switches", () => {
    expect(switchesFrom({ reminders: false, budget_summary: true, condition_report: false })).toEqual({
      reminders: false,
      budget_summary: true,
      condition_report: false,
    });
  });
});

it("names what was turned off", () => {
  expect(unsubscribedText("all")).toMatch(/any more automatic emails/);
  expect(unsubscribedText("condition_report")).toBe("You won't get the yearly condition report email any more.");
  expect(isUnsubscribeKind("reminders")).toBe(true);
  expect(isUnsubscribeKind("reminder")).toBe(false);
});
