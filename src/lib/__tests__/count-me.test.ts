import { applyCountMe, COUNT_ME_KEY, countMeRequest, isNotCounted, sendsPrivacySignal, withoutCountMe } from "../count-me";

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

function at(href: string) {
  return { href, search: new URL(href).search };
}

describe("count-me switch", () => {
  it("reads off and on, in any case, and ignores anything else", () => {
    expect(countMeRequest("?count-me=off")).toBe("off");
    expect(countMeRequest("?a=1&count-me=ON")).toBe("on");
    expect(countMeRequest("?count-me=maybe")).toBeNull();
    expect(countMeRequest("")).toBeNull();
  });

  it("drops only its own parameter from the address", () => {
    expect(withoutCountMe("https://capexclock.com/pricing?a=1&count-me=off#x")).toBe("https://capexclock.com/pricing?a=1#x");
    expect(withoutCountMe("https://capexclock.com/?count-me=on")).toBe("https://capexclock.com/");
  });

  it("marks the browser with off, unmarks it with on, and cleans the address", () => {
    const store = memoryStore();
    const replaced: string[] = [];
    expect(applyCountMe(at("https://capexclock.com/?count-me=off"), () => store, (h) => replaced.push(h))).toBe(false);
    expect(store.getItem(COUNT_ME_KEY)).toBe("off");
    // Later visits stay uncounted without the parameter.
    expect(applyCountMe(at("https://capexclock.com/lifespan"), () => store, (h) => replaced.push(h))).toBe(false);
    expect(applyCountMe(at("https://capexclock.com/?count-me=on"), () => store, (h) => replaced.push(h))).toBe(true);
    expect(store.getItem(COUNT_ME_KEY)).toBeNull();
    expect(replaced).toEqual(["https://capexclock.com/", "https://capexclock.com/"]);
  });

  it("counts everyone else, including browsers that block storage", () => {
    expect(applyCountMe(at("https://capexclock.com/"), () => memoryStore(), () => {})).toBe(true);
    const blocked = () => {
      throw new Error("blocked");
    };
    expect(applyCountMe(at("https://capexclock.com/?count-me=off"), blocked, () => {})).toBe(true);
    expect(isNotCounted(blocked)).toBe(false);
    expect(isNotCounted(() => memoryStore({ [COUNT_ME_KEY]: "off" }))).toBe(true);
  });

  it("treats only a Global Privacy Control signal that's on as one", () => {
    expect(sendsPrivacySignal({ globalPrivacyControl: true })).toBe(true);
    expect(sendsPrivacySignal({ globalPrivacyControl: false })).toBe(false);
    expect(sendsPrivacySignal({ globalPrivacyControl: "1" })).toBe(false);
    expect(sendsPrivacySignal({})).toBe(false);
  });
});

describe("Global Privacy Control", () => {
  const original = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    process.env.NEXT_PUBLIC_POSTHOG_KEY = original;
  });

  // A fresh copy of analytics.ts (it remembers its answer per page load) in a pretend browser.
  function pageLoad(href: string, gpc: boolean | undefined, store = memoryStore()) {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
    (globalThis as { window?: unknown }).window = {
      location: at(href),
      localStorage: store,
      history: { state: null, replaceState: () => {} },
      navigator: gpc === undefined ? {} : { globalPrivacyControl: gpc },
      dispatchEvent: () => true,
    };
    let analytics!: typeof import("../analytics");
    jest.isolateModules(() => {
      analytics = jest.requireActual<typeof import("../analytics")>("../analytics");
    });
    return { analytics, store };
  }

  it("keeps PostHog from loading, even with ?count-me=on", async () => {
    const { analytics } = pageLoad("https://capexclock.com/?count-me=on", true);
    expect(analytics.countsThisBrowser()).toBe(false);
    await expect(analytics.initAnalytics()).resolves.toBeNull();
  });

  it("still saves ?count-me=off, so the browser stays uncounted if the signal is turned off", () => {
    const { analytics, store } = pageLoad("https://capexclock.com/?count-me=off", true);
    expect(analytics.countsThisBrowser()).toBe(false);
    expect(store.getItem(COUNT_ME_KEY)).toBe("off");
    expect(pageLoad("https://capexclock.com/", false, store).analytics.countsThisBrowser()).toBe(false);
  });

  it("counts browsers without the signal", () => {
    expect(pageLoad("https://capexclock.com/", false).analytics.countsThisBrowser()).toBe(true);
    expect(pageLoad("https://capexclock.com/", undefined).analytics.countsThisBrowser()).toBe(true);
  });
});
