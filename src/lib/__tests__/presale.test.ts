import {
  firstCompletionThisVisit,
  FOUNDING_PRICE_TEXT,
  FOUNDING_PROMISE_TEXT,
  isOffer,
  isTestLink,
  OFFER_TEXT,
  OFFERS,
  offerForIdea,
  PAID_IDEAS,
  presaleEvent,
  presaleLinks,
  presaleLinksFromEnv,
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
  it("checks each setting, naming the one that was refused", () => {
    const warn = jest.fn();
    const links = presaleLinks(
      { membership: "https://buy.stripe.com/m", report: "https://example.com/r", portal: "" },
      warn,
    );
    expect(links).toEqual({ offers: { membership: "https://buy.stripe.com/m", report: null }, portal: null });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/^NEXT_PUBLIC_STRIPE_LINK_REPORT: /);
  });

  it("reads the Netlify settings, and warns only in development", () => {
    const env = process.env as Record<string, string | undefined>;
    const before = { ...env };
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      env.NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP = "https://buy.stripe.com/m";
      env.NEXT_PUBLIC_STRIPE_LINK_REPORT = "http://buy.stripe.com/r";
      env.NEXT_PUBLIC_STRIPE_PORTAL_LINK = "https://billing.stripe.com/p/login/p";
      expect(presaleLinksFromEnv()).toEqual({
        offers: { membership: "https://buy.stripe.com/m", report: null },
        portal: "https://billing.stripe.com/p/login/p",
      });
      expect(warn).not.toHaveBeenCalled();
      env.NODE_ENV = "development";
      presaleLinksFromEnv();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("NEXT_PUBLIC_STRIPE_LINK_REPORT");
    } finally {
      warn.mockRestore();
      for (const key of Object.keys(env)) if (!(key in before)) delete env[key];
      Object.assign(env, before);
    }
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

describe("price and report wording (plan T5)", () => {
  const everything = [
    ...OFFERS.flatMap((o) => Object.values(OFFER_TEXT[o])),
    FOUNDING_PRICE_TEXT,
    FOUNDING_PROMISE_TEXT,
    REPORT_LABEL,
  ].join(" ");

  it("says the membership price the approved way", () => {
    expect(OFFER_TEXT.membership.priceNote).toBe("$12 every month until you cancel. Cancel any time online.");
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
