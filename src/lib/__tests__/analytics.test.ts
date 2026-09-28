import type { CaptureResult } from "posthog-js";
import {
  DEFAULT_POSTHOG_HOST,
  posthogHost,
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
