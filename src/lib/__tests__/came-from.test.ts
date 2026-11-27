import { describe, expect, it } from "@jest/globals";
import { CAME_FROM_MAX_AGE_MS, cameFromVisit, chooseCameFrom, cleanTag, parseCameFrom, referrerSite } from "../came-from";

const NOW = Date.UTC(2026, 10, 27);

describe("cameFromVisit", () => {
  it("keeps a link's tracking tags", () => {
    expect(
      cameFromVisit("?utm_source=gosocially&utm_medium=social&utm_content=instagram&utm_campaign=taco-night&x=1", "", "capexclock.com", NOW),
    ).toEqual({ at: NOW, utm_source: "gosocially", utm_medium: "social", utm_content: "instagram", utm_campaign: "taco-night" });
  });

  it("falls back to the website that linked here", () => {
    expect(cameFromVisit("", "https://l.instagram.com/?u=x", "capexclock.com", NOW)).toEqual({
      at: NOW,
      utm_source: "instagram.com",
      utm_medium: "referral",
      fromSite: true,
    });
  });

  it("says nothing for a visit from DinnerWin itself or with no referrer", () => {
    expect(cameFromVisit("", "https://capexclock.com/blog", "capexclock.com", NOW)).toBeNull();
    expect(cameFromVisit("", "https://www.capexclock.com/", "capexclock.com", NOW)).toBeNull();
    expect(cameFromVisit("", "", "capexclock.com", NOW)).toBeNull();
    expect(cameFromVisit("?utm_source=", "", "capexclock.com", NOW)).toBeNull();
  });
});

describe("referrerSite", () => {
  it("shortens common prefixes and ignores non-web addresses", () => {
    expect(referrerSite("https://www.pinterest.com/pin/1", "capexclock.com")).toBe("pinterest.com");
    expect(referrerSite("android-app://com.google.android.gm", "capexclock.com")).toBeNull();
    expect(referrerSite("not a url", "capexclock.com")).toBeNull();
    expect(referrerSite("https://capexclock.netlify.app/", "capexclock.netlify.app")).toBeNull();
  });
});

describe("cleanTag", () => {
  it("trims, drops control characters and cuts long values", () => {
    expect(cleanTag("  ig\u0000 ")).toBe("ig");
    expect(cleanTag("x".repeat(150))).toHaveLength(100);
    expect(cleanTag("   ")).toBeUndefined();
    expect(cleanTag(3)).toBeUndefined();
  });
});

describe("parseCameFrom", () => {
  it("reads what was kept", () => {
    const kept = { at: NOW - 1000, utm_source: "pinterest" };
    expect(parseCameFrom(JSON.stringify(kept), NOW)).toEqual(kept);
  });

  it("forgets it after 30 days, and ignores broken or empty values", () => {
    expect(parseCameFrom(JSON.stringify({ at: NOW - CAME_FROM_MAX_AGE_MS - 1, utm_source: "x" }), NOW)).toBeNull();
    expect(parseCameFrom("{nope", NOW)).toBeNull();
    expect(parseCameFrom(JSON.stringify({ at: NOW }), NOW)).toBeNull();
    expect(parseCameFrom(null, NOW)).toBeNull();
  });
});

describe("chooseCameFrom", () => {
  const tagged = { at: NOW, utm_source: "gosocially" };
  const site = { at: NOW, utm_source: "google.com", utm_medium: "referral", fromSite: true };

  it("lets a tagged link replace what was kept", () => {
    expect(chooseCameFrom(site, tagged)).toBe(tagged);
  });

  it("lets a website only fill in when nothing was kept", () => {
    expect(chooseCameFrom(tagged, site)).toBe(tagged);
    expect(chooseCameFrom(null, site)).toBe(site);
    expect(chooseCameFrom(tagged, null)).toBe(tagged);
  });
});
