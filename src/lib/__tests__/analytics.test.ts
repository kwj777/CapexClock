import type { CaptureResult } from "posthog-js";
import {
  daysSinceLastVisit,
  DEFAULT_POSTHOG_HOST,
  identifyPerson,
  localDay,
  posthogHost,
  recordVisit,
  withoutPageTitle,
} from "../analytics";

describe("posthogHost", () => {
  it("uses the default host when the setting is missing or blank", () => {
    expect(posthogHost(undefined)).toBe(DEFAULT_POSTHOG_HOST);
    expect(posthogHost("")).toBe(DEFAULT_POSTHOG_HOST);
    expect(posthogHost("  ")).toBe(DEFAULT_POSTHOG_HOST);
  });

  it("keeps a host that is set", () => {
    expect(posthogHost("https://eu.i.posthog.com")).toBe("https://eu.i.posthog.com");
  });
});

describe("withoutPageTitle", () => {
  it("drops the page title, which can name a property", () => {
    const event: CaptureResult = {
      uuid: "1",
      event: "$pageview",
      properties: { title: "22 Oak Street, Unit B | CapexClock", $pathname: "/app/properties/abc" },
    };
    expect(withoutPageTitle(event)?.properties).toEqual({ $pathname: "/app/properties/abc" });
  });

  it("passes other events and dropped events through", () => {
    const event: CaptureResult = { uuid: "2", event: "property_saved", properties: { components: "4" } };
    expect(withoutPageTitle(event)).toBe(event);
    expect(withoutPageTitle(null)).toBeNull();
  });
});

describe("daysSinceLastVisit", () => {
  it("counts whole days since an earlier visit", () => {
    expect(daysSinceLastVisit("2026-09-27", "2026-09-28")).toBe(1);
    expect(daysSinceLastVisit("2026-08-29", "2026-09-28")).toBe(30);
    // Across a daylight-saving change.
    expect(daysSinceLastVisit("2026-10-31", "2026-11-02")).toBe(2);
  });

  it("is null for a first visit, the same day, a later date or bad data", () => {
    expect(daysSinceLastVisit(null, "2026-09-28")).toBeNull();
    expect(daysSinceLastVisit("2026-09-28", "2026-09-28")).toBeNull();
    expect(daysSinceLastVisit("2026-09-29", "2026-09-28")).toBeNull();
    expect(daysSinceLastVisit("yesterday", "2026-09-28")).toBeNull();
  });
});

describe("localDay", () => {
  it("formats the local calendar date", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("recordVisit", () => {
  const day1 = new Date(2026, 8, 27, 9);
  const day1Later = new Date(2026, 8, 27, 18);
  const day3 = new Date(2026, 8, 29, 8);

  it("sends nothing on a browser's first visit, then once on each later day", () => {
    const capture = jest.fn();
    const storage = memoryStorage();
    recordVisit({ capture }, () => storage, day1);
    expect(capture).not.toHaveBeenCalled();

    recordVisit({ capture }, () => storage, day1Later);
    expect(capture).not.toHaveBeenCalled();

    recordVisit({ capture }, () => storage, day3);
    recordVisit({ capture }, () => storage, day3);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith("return_visit", { days_since_last_visit: 2 });
  });

  it("sends nothing when storage is blocked", () => {
    const capture = jest.fn();
    recordVisit({ capture }, () => {
      throw new Error("SecurityError");
    }, day3);
    expect(capture).not.toHaveBeenCalled();
  });
});

describe("identifyPerson", () => {
  function fakePostHog(state: { distinctId: string; identified: boolean }) {
    return {
      calls: [] as string[],
      get_property(name: string) {
        return name === "$user_state" ? (state.identified ? "identified" : "anonymous") : undefined;
      },
      get_distinct_id() {
        return state.distinctId;
      },
      reset() {
        this.calls.push("reset");
        state.distinctId = "new-anonymous-id";
        state.identified = false;
      },
      identify(id: string) {
        this.calls.push(`identify:${id}`);
        state.distinctId = id;
        state.identified = true;
      },
    };
  }

  it("identifies an anonymous visitor by user id", () => {
    const posthog = fakePostHog({ distinctId: "anon-1", identified: false });
    identifyPerson(posthog, "user-a");
    expect(posthog.calls).toEqual(["identify:user-a"]);
  });

  it("does nothing new for the same signed-in user", () => {
    const posthog = fakePostHog({ distinctId: "user-a", identified: true });
    identifyPerson(posthog, "user-a");
    expect(posthog.calls).toEqual(["identify:user-a"]);
  });

  it("starts a new person when a different account signs in on the same browser", () => {
    const posthog = fakePostHog({ distinctId: "user-a", identified: true });
    identifyPerson(posthog, "user-b");
    expect(posthog.calls).toEqual(["reset", "identify:user-b"]);
  });
});
