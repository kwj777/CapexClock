import {
  buyNowClick,
  firstCompletionThisVisit,
  FOUNDING_PRICE_TEXT,
  FOUNDING_PROMISE_TEXT,
  isOffer,
  isTestLink,
  MEMBERSHIP_RENEWS_TEXT,
  OFFER_TEXT,
  OFFERS,
  offerForIdea,
  PAID_IDEAS,
  presaleEvent,
  presaleLinks,
  REPORT_LABEL,
  stripeLink,
} from "../paid-ideas";

describe("stripeLink", () => {
  it("takes Payment Links on buy.stripe.com, live or test", () => {
    expect(stripeLink("https://buy.stripe.com/aEU5kD0Xm2Pz", "payment")).toBe("https://buy.stripe.com/aEU5kD0Xm2Pz");
    expect(stripeLink("https://buy.stripe.com/test_aEU5kD0Xm2Pz", "payment")).toBe(
      "https://buy.stripe.com/test_aEU5kD0Xm2Pz",
    );
  });

  it("takes the customer portal's login link on billing.stripe.com", () => {
    expect(stripeLink("https://billing.stripe.com/p/login/test_9AQ", "portal")).toBe(
      "https://billing.stripe.com/p/login/test_9AQ",
    );
  });

  it("trims what was pasted, and tidies the host's case", () => {
    expect(stripeLink("  https://BUY.stripe.com/abc \n", "payment")).toBe("https://buy.stripe.com/abc");
  });

  it("treats blank as not set, without a warning", () => {
    const warn = jest.fn();
    for (const setting of [undefined, "", "   "]) expect(stripeLink(setting, "payment", warn)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("refuses anything that isn't an https link on Stripe's own host, and says why", () => {
    const refused = [
      "buy.stripe.com/abc",
      "http://buy.stripe.com/abc",
      "https://buy.stripe.com.example.com/abc",
      "https://example.com/buy.stripe.com/abc",
      "https://stripe.com/abc",
      "https://evil@buy.stripe.com/abc",
      "https://user:pass@buy.stripe.com/abc",
      "https://buy.stripe.com:8443/abc",
      "https://buy.stripe.com/",
      "https://buy.stripe.com",
      "javascript:alert(1)",
      "not a link",
    ];
    for (const setting of refused) {
      const warn = jest.fn();
      expect(stripeLink(setting, "payment", warn)).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
    }
  });

  it("keeps each kind on its own host, so a link pasted in the wrong box is caught", () => {
    expect(stripeLink("https://billing.stripe.com/p/login/abc", "payment")).toBeNull();
    expect(stripeLink("https://buy.stripe.com/abc", "portal")).toBeNull();
  });
});

describe("isTestLink", () => {
  it("spots Stripe's test-mode links", () => {
    expect(isTestLink("https://buy.stripe.com/test_abc")).toBe(true);
    expect(isTestLink("https://billing.stripe.com/p/login/test_abc")).toBe(true);
    expect(isTestLink("https://buy.stripe.com/abc")).toBe(false);
    expect(isTestLink("https://billing.stripe.com/p/login/abc")).toBe(false);
  });
});

describe("presaleLinks", () => {
  const PORTAL = "https://billing.stripe.com/p/login/p";

  it("checks each setting, naming the one that was refused", () => {
    const warn = jest.fn();
    const links = presaleLinks(
      { membership: "https://buy.stripe.com/m", report: "https://example.com/r", portal: PORTAL },
      warn,
    );
    expect(links).toEqual({ offers: { membership: "https://buy.stripe.com/m", report: null }, portal: PORTAL });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/^NEXT_PUBLIC_STRIPE_LINK_REPORT: /);
  });

  it("sells the membership only with a portal link, so members can always cancel online", () => {
    // Blank, or a link that isn't the portal's login link (the portal's settings page, say).
    for (const portal of [undefined, "", "https://dashboard.stripe.com/settings/billing/portal"]) {
      const warn = jest.fn();
      const settings = { membership: "https://buy.stripe.com/m", report: "https://buy.stripe.com/r", portal };
      const links = presaleLinks(settings, warn);
      expect(links).toEqual({ offers: { membership: null, report: "https://buy.stripe.com/r" }, portal: null });
      const said = warn.mock.calls.map(([message]: [string]) => message).join("\n");
      expect(said).toContain(
        "NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP is ignored until NEXT_PUBLIC_STRIPE_PORTAL_LINK is set",
      );
    }
  });

  it("sells the membership only when it and the portal link are from the same Stripe mode", () => {
    const LIVE_M = "https://buy.stripe.com/liveM";
    const TEST_M = "https://buy.stripe.com/test_M";
    const LIVE_P = "https://billing.stripe.com/p/login/liveP";
    const TEST_P = "https://billing.stripe.com/p/login/test_P";
    const cases = [
      {
        membership: LIVE_M,
        portal: TEST_P,
        said: "the membership link is a live link, and the portal link is a test-mode link",
      },
      {
        membership: TEST_M,
        portal: LIVE_P,
        said: "the membership link is a test-mode link, and the portal link is a live link",
      },
    ];
    for (const { membership, portal, said } of cases) {
      const warn = jest.fn();
      const links = presaleLinks({ membership, report: "https://buy.stripe.com/r", portal }, warn);
      // The portal stays, so anyone already a member in that mode can still cancel.
      expect(links).toEqual({ offers: { membership: null, report: "https://buy.stripe.com/r" }, portal });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(
        /^NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP and NEXT_PUBLIC_STRIPE_PORTAL_LINK are from different Stripe modes/,
      );
      expect(warn.mock.calls[0][0]).toContain(said);
      expect(warn.mock.calls[0][0]).toContain("The membership isn't on sale.");
    }
    for (const [membership, portal] of [
      [LIVE_M, LIVE_P],
      [TEST_M, TEST_P],
    ]) {
      const warn = jest.fn();
      expect(presaleLinks({ membership, portal }, warn).offers.membership).toBe(membership);
      expect(warn).not.toHaveBeenCalled();
    }
  });

  it("doesn't tie the report's mode to anything", () => {
    const warn = jest.fn();
    const links = presaleLinks(
      { membership: "https://buy.stripe.com/m", report: "https://buy.stripe.com/test_r", portal: PORTAL },
      warn,
    );
    expect(links.offers).toEqual({ membership: "https://buy.stripe.com/m", report: "https://buy.stripe.com/test_r" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps the portal link without a membership link, so members can cancel after sales stop", () => {
    const warn = jest.fn();
    expect(presaleLinks({ portal: PORTAL }, warn)).toEqual({
      offers: { membership: null, report: null },
      portal: PORTAL,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("doesn't mention the portal when the membership link is blank", () => {
    const warn = jest.fn();
    presaleLinks({ report: "https://buy.stripe.com/r" }, warn);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("presaleLinksFromEnv", () => {
  const env = process.env as Record<string, string | undefined>;
  let before: Record<string, string | undefined>;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    before = { ...env };
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    env.NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP = "https://buy.stripe.com/m";
    env.NEXT_PUBLIC_STRIPE_LINK_REPORT = "http://buy.stripe.com/r";
    env.NEXT_PUBLIC_STRIPE_PORTAL_LINK = "https://billing.stripe.com/p/login/p";
    delete env.NEXT_PHASE;
  });

  afterEach(() => {
    warn.mockRestore();
    for (const key of Object.keys(env)) if (!(key in before)) delete env[key];
    Object.assign(env, before);
  });

  /** A fresh copy of the module, so each test starts with nothing warned yet. */
  function fresh(): typeof import("../paid-ideas") {
    let mod: typeof import("../paid-ideas") | undefined;
    jest.isolateModules(() => {
      mod = jest.requireActual<typeof import("../paid-ideas")>("../paid-ideas");
    });
    return mod as typeof import("../paid-ideas");
  }

  it("reads the Netlify settings, and says nothing on the live site", () => {
    expect(fresh().presaleLinksFromEnv()).toEqual({
      offers: { membership: "https://buy.stripe.com/m", report: null },
      portal: "https://billing.stripe.com/p/login/p",
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns in development", () => {
    env.NODE_ENV = "development";
    fresh().presaleLinksFromEnv();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("NEXT_PUBLIC_STRIPE_LINK_REPORT");
  });

  it("warns during next build, so it shows in the deploy log, once however many pages read it", () => {
    env.NEXT_PHASE = "phase-production-build";
    delete env.NEXT_PUBLIC_STRIPE_PORTAL_LINK;
    const mod = fresh();
    for (let i = 0; i < 3; i++) expect(mod.presaleLinksFromEnv().offers.membership).toBeNull();
    const said = warn.mock.calls.map(([message]: [string]) => message);
    expect(said).toHaveLength(2);
    expect(said[0]).toMatch(/^\[CapexClock\] NEXT_PUBLIC_STRIPE_LINK_REPORT: /);
    expect(said[1]).toMatch(
      /^\[CapexClock\] NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP is ignored until NEXT_PUBLIC_STRIPE_PORTAL_LINK/,
    );
  });
});

describe("offers", () => {
  it("sells reminders as the membership and the report as the report, and never the photo idea", () => {
    expect(offerForIdea("reminders")).toBe("membership");
    expect(offerForIdea("report")).toBe("report");
    expect(offerForIdea("photo")).toBeNull();
    expect(PAID_IDEAS.map(offerForIdea).filter(Boolean).sort()).toEqual([...OFFERS].sort());
  });

  it("knows a thank-you page's offer from its address", () => {
    expect(isOffer("membership")).toBe(true);
    expect(isOffer("report")).toBe(true);
    expect(isOffer("photo")).toBe(false);
    expect(isOffer("constructor")).toBe(false);
  });

  it("send the offer and nothing else with their events", () => {
    expect(presaleEvent("report")).toEqual({ offer: "report" });
  });
});

describe("buyNowClick", () => {
  const click = { leaving: false, counted: false, newTab: false };

  it("goes to Stripe and counts the first click", () => {
    expect(buyNowClick(click)).toEqual({ step: "go", send: true });
  });

  it("ignores a double click while the page is leaving", () => {
    expect(buyNowClick({ ...click, leaving: true, counted: true })).toEqual({ step: "ignore", send: false });
    expect(buyNowClick({ ...click, leaving: true, counted: true, newTab: true })).toEqual({
      step: "ignore",
      send: false,
    });
  });

  it("goes again without counting again after a canceled 'leave page?' prompt", () => {
    expect(buyNowClick({ ...click, counted: true })).toEqual({ step: "go", send: false });
  });

  it("counts every new tab, since each is a trip to Stripe", () => {
    expect(buyNowClick({ ...click, newTab: true })).toEqual({ step: "new-tab", send: true });
    expect(buyNowClick({ ...click, counted: true, newTab: true })).toEqual({ step: "new-tab", send: true });
  });
});

describe("price and report wording (plan T5)", () => {
  const everything = [
    ...OFFERS.flatMap((o) => Object.values(OFFER_TEXT[o])),
    FOUNDING_PRICE_TEXT,
    FOUNDING_PROMISE_TEXT,
    REPORT_LABEL,
  ].join(" ");

  it("says the membership price the approved way", () => {
    expect(OFFER_TEXT.membership.priceNote).toBe("$12 every month until you cancel. Cancel any time online.");
    expect(MEMBERSHIP_RENEWS_TEXT).toBe("$12 every month until you cancel.");
    expect(FOUNDING_PRICE_TEXT).toBe("$12/month founding price, kept for as long as you stay a member.");
    expect(OFFER_TEXT.report.price).toBe("$29 once");
  });

  it("never shows $12 as a discount or promises it for life", () => {
    expect(everything).not.toMatch(/\$19|normally|locked|for life|forever|was \$|save \$|discount/i);
  });

  it("says the report is for lenders and buyers, never what lenders accept", () => {
    expect(everything).not.toMatch(/lender-ready|accepted by lenders|lender ready/i);
    expect(OFFER_TEXT.report.includes).toContain("for lenders and buyers");
  });

  it("labels every report as a planning document", () => {
    expect(REPORT_LABEL).toBe(
      "Prepared by CapexClock from information the owner supplied. A planning document, not an inspection.",
    );
  });

  it("promises nothing about what we'll build", () => {
    expect(everything).not.toMatch(/while we build|automatic version|we will build|we'll build|until then/i);
  });

  it("uses no em dashes", () => {
    expect(everything).not.toContain("—");
  });
});

describe("firstCompletionThisVisit", () => {
  function memoryStorage() {
    const items = new Map<string, string>();
    return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) };
  }

  it("counts each offer's thank-you page once per visit", () => {
    const storage = memoryStorage();
    expect(firstCompletionThisVisit("membership", () => storage)).toBe(true);
    // A reload.
    expect(firstCompletionThisVisit("membership", () => storage)).toBe(false);
    expect(firstCompletionThisVisit("report", () => storage)).toBe(true);
    // A new visit has its own session storage.
    expect(firstCompletionThisVisit("membership", () => memoryStorage())).toBe(true);
  });

  it("counts it when storage is blocked", () => {
    expect(
      firstCompletionThisVisit("report", () => {
        throw new Error("blocked");
      }),
    ).toBe(true);
  });
});
