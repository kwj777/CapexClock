import type { CaptureResult } from "posthog-js";
import {
  captureOptions,
  daysSinceLastVisit,
  identifyPerson,
  localDay,
  POSTHOG_UI_HOST,
  posthogHosts,
  RELAY_PATH,
  recordVisit,
  withoutPageTitle,
} from "../analytics";

describe("posthogHosts", () => {
  it("goes through this site's relay when the setting is missing or blank", () => {
    const relay = { api_host: "/clockwork", ui_host: "https://us.posthog.com" };
    expect(posthogHosts(undefined)).toEqual(relay);
    expect(posthogHosts("")).toEqual(relay);
    expect(posthogHosts("  ")).toEqual(relay);
    expect(relay).toEqual({ api_host: RELAY_PATH, ui_host: POSTHOG_UI_HOST });
  });

  it("uses a host that is set as it is, and lets PostHog work out its app's address", () => {
    expect(posthogHosts("https://us.i.posthog.com")).toEqual({ api_host: "https://us.i.posthog.com" });
    expect(posthogHosts(" https://eu.i.posthog.com ")).toEqual({ api_host: "https://eu.i.posthog.com" });
  });
});

describe("captureOptions", () => {
  it("batches ordinary events as PostHog normally does", () => {
    expect(captureOptions(false)).toBeUndefined();
  });

  it("sends a click that leaves the page at once, as a beacon PostHog won't send twice", () => {
    expect(captureOptions(true)).toEqual({ send_instantly: true, transport: "sendBeacon" });
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
