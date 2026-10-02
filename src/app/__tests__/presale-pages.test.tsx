import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// /pricing, /terms, the thank-you pages, the footer and the sitemap, with and
// without the Stripe settings. Each render gets a fresh copy of the modules,
// because the settings are read when a module loads (as at build time).

jest.mock("@/lib/library/source", () => ({ getLibrary: async () => [] }));

const SETTINGS = {
  NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP: "https://buy.stripe.com/live_m",
  NEXT_PUBLIC_STRIPE_LINK_REPORT: "https://buy.stripe.com/live_r",
  NEXT_PUBLIC_STRIPE_PORTAL_LINK: "https://billing.stripe.com/p/login/live_p",
};
type Settings = Partial<typeof SETTINGS>;

const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

/** Loads a module with these settings (and only these), and hands it to `check`. */
async function withSettings<T>(settings: Settings, load: () => Promise<T>, check: (mod: T) => Promise<void> | void) {
  const env = process.env as Record<string, string | undefined>;
  const before = { ...env };
  for (const key of Object.keys(SETTINGS)) delete env[key];
  Object.assign(env, settings);
  try {
    let mod: T | undefined;
    await jest.isolateModulesAsync(async () => {
      mod = await load();
    });
    await check(mod as T);
  } finally {
    for (const key of Object.keys(env)) if (!(key in before)) delete env[key];
    Object.assign(env, before);
  }
}

async function renderPricing(settings: Settings): Promise<string> {
  let html = "";
  await withSettings(
    settings,
    async () => ({ page: await import("../pricing/page"), server: await import("react-dom/server") }),
    ({ page, server }) => {
      html = server.renderToStaticMarkup(page.default());
    },
  );
  return html;
}

describe("/pricing", () => {
  it("puts Free next to the two offers, with the approved wording", async () => {
    const page = text(await renderPricing({}));
    expect(page).toContain("Free today, with no limits during early access.");
    expect(page).toContain("$12/month founding price, kept for as long as you stay a member.");
    expect(page).toContain("$12 every month until you cancel. Cancel any time online.");
    expect(page).toContain("$29 once");
    expect(page).toContain("For lenders and buyers. A planning document, not an inspection.");
  });

  it("says the offers aren't on sale until their links are set", async () => {
    const html = await renderPricing({});
    expect(html).not.toContain("Buy now");
    expect(text(html).match(/Not on sale right now\./g)).toHaveLength(2);
  });

  it("shows Buy now for each offer whose link is set", async () => {
    const html = await renderPricing({ NEXT_PUBLIC_STRIPE_LINK_REPORT: SETTINGS.NEXT_PUBLIC_STRIPE_LINK_REPORT });
    expect(html).toContain(`href="${SETTINGS.NEXT_PUBLIC_STRIPE_LINK_REPORT}"`);
    expect(html.match(/>Buy now</g)).toHaveLength(1);
    expect(text(html).match(/Not on sale right now\./g)).toHaveLength(1);

    const both = await renderPricing(SETTINGS);
    expect(both.match(/>Buy now</g)).toHaveLength(2);
    expect(both).toContain(`href="${SETTINGS.NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP}"`);
  });

  it("links to the terms and the sample report", async () => {
    const html = await renderPricing({});
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/sample-condition-report.pdf"');
  });

  it("has FAQPage data that matches the questions on the page", async () => {
    for (const settings of [{}, SETTINGS]) {
      const html = await renderPricing(settings);
      const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? "";
      const data = JSON.parse(json) as {
        "@type": string;
        mainEntity: { name: string; acceptedAnswer: { text: string } }[];
      };
      expect(data["@type"]).toBe("FAQPage");
      const shown = [...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt><dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => ({
        q: text(m[1]),
        a: text(m[2]),
      }));
      expect(shown.length).toBeGreaterThanOrEqual(5);
      expect(data.mainEntity.map((e) => ({ q: e.name, a: e.acceptedAnswer.text }))).toEqual(shown);
    }
  });

  it("never sells the membership without the portal link, where members cancel online", async () => {
    const membershipOnly = { NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP: SETTINGS.NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP };
    const settingsPage = "https://dashboard.stripe.com/settings/billing/portal";
    for (const settings of [membershipOnly, { ...membershipOnly, NEXT_PUBLIC_STRIPE_PORTAL_LINK: settingsPage }]) {
      const html = await renderPricing(settings);
      expect(html).not.toContain("Buy now");
      expect(html).not.toContain(SETTINGS.NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP);
      expect(text(html).match(/Not on sale right now\./g)).toHaveLength(2);
    }
  });

  it("says how to cancel online, with the link once memberships are on sale", async () => {
    expect(text(await renderPricing(SETTINGS))).toContain(
      "Any time online, with Manage or cancel membership at the bottom of every page.",
    );
    expect(text(await renderPricing({}))).toContain(
      "which goes at the bottom of every page when memberships go on sale. Or email support@capexclock.com.",
    );
  });
});

describe("/terms", () => {
  async function renderTerms(settings: Settings): Promise<string> {
    let html = "";
    await withSettings(
      settings,
      async () => ({ page: await import("../terms/page"), server: await import("react-dom/server") }),
      ({ page, server }) => {
        html = server.renderToStaticMarkup(page.default());
      },
    );
    return html;
  }

  it("covers everything plan T5 lists", async () => {
    const page = text(await renderTerms(SETTINGS));
    // What each offer includes.
    expect(page).toContain("An email from us before each replacement comes due");
    expect(page).toContain("A condition report on your building for lenders and buyers");
    // Renewal and canceling online.
    expect(page).toContain("It renews at $12 every month until you cancel.");
    expect(page).toContain("You can cancel any time online");
    // Refund, label, sharing, liability, the founding promise and contact.
    expect(page).toContain("within 30 days of a payment and we'll refund that payment in full");
    expect(page).toContain(
      "Prepared by CapexClock from information the owner supplied. A planning document, not an inspection.",
    );
    expect(page).toContain("You may share your report with anyone");
    expect(page).toContain("No one but you may rely on it, and buyers and lenders should get their own inspection.");
    expect(page).toContain("limited to the amount you paid us for it");
    expect(page).toContain("If we don't build reminders, we cancel every founding membership and refund every payment");
    expect(page).toContain("support@capexclock.com");
    expect(page).toContain("licensed professional");
  });

  it("links to the customer portal when it's set, and says where it goes when it isn't", async () => {
    const withPortal = await renderTerms(SETTINGS);
    expect(withPortal).toContain(`href="${SETTINGS.NEXT_PUBLIC_STRIPE_PORTAL_LINK}"`);
    expect(text(withPortal)).toContain("You can cancel any time online, through Manage or cancel membership");
    const without = text(await renderTerms({}));
    expect(without).toContain("You can cancel any time online, through Stripe's customer portal.");
    expect(without).toContain("goes at the bottom of every page when memberships go on sale");
    expect(without).toContain("You can also cancel by emailing support@capexclock.com.");
  });
});

describe("the thank-you pages", () => {
  type ThanksModule = typeof import("../thanks/[offer]/page");
  const props = (offer: string) => ({ params: Promise.resolve({ offer }), searchParams: Promise.resolve({}) });

  async function renderThanks(offer: string, settings: Settings = SETTINGS): Promise<string> {
    let html = "";
    await withSettings(
      settings,
      async () => ({ page: await import("../thanks/[offer]/page"), server: await import("react-dom/server") }),
      async ({ page, server }) => {
        html = server.renderToStaticMarkup(await page.default(props(offer)));
      },
    );
    return html;
  }

  it("exist for the two offers only, and are hidden from search", async () => {
    await withSettings({}, () => import("../thanks/[offer]/page"), async (page: ThanksModule) => {
      expect(page.generateStaticParams()).toEqual([{ offer: "membership" }, { offer: "report" }]);
      expect(page.dynamicParams).toBe(false);
      for (const offer of ["membership", "report"]) {
        const meta = await page.generateMetadata(props(offer));
        expect(meta.robots).toEqual({ index: false, follow: false });
      }
      await expect(page.default(props("photo"))).rejects.toThrow();
    });
  });

  it("tell a new member what happens next, how to send a sheet, and how to cancel", async () => {
    const html = await renderThanks("membership");
    const page = text(html);
    expect(page).toContain("Thanks for becoming a founding member");
    expect(page).toContain("What happens next");
    expect(html).toContain('href="mailto:support@capexclock.com?subject=');
    // The buttons' own names, so a buyer can find them under the forecast.
    expect(page).toContain("Download PDF or Download component list (Excel)");
    expect(page).toContain("$12 every month until you cancel. Cancel any time online.");
    expect(html).toContain(`href="${SETTINGS.NEXT_PUBLIC_STRIPE_PORTAL_LINK}"`);
    expect(page).toContain("Manage or cancel membership");
    expect(html).toContain('href="/terms"');
  });

  it("say to email to cancel, and don't promise an online way, if the portal link is taken out", async () => {
    const page = text(await renderThanks("membership", {}));
    expect(page).toContain("$12 every month until you cancel.");
    expect(page).not.toContain("Cancel any time online");
    expect(page).toContain("To cancel, email support@capexclock.com");
  });

  it("tell a report buyer what to send and when it comes", async () => {
    const html = await renderThanks("report");
    const page = text(html);
    expect(page).toContain("Thanks for ordering a condition report");
    expect(html).toContain('href="mailto:support@capexclock.com?subject=Condition%20report');
    expect(page).toContain("within 2 business days of getting your details");
    expect(page).toContain("A planning document, not an inspection.");
    expect(html).toContain('href="/sample-condition-report.pdf"');
    expect(page).not.toContain("Cancel any time");
  });
});

describe("the footer", () => {
  async function renderFooter(settings: Settings): Promise<string> {
    let html = "";
    await withSettings(
      settings,
      async () => ({ chrome: await import("@/components/SiteChrome"), server: await import("react-dom/server") }),
      ({ chrome, server }) => {
        html = server.renderToStaticMarkup(chrome.SiteFooter());
      },
    );
    return html;
  }

  it("links to pricing and the terms", async () => {
    const html = await renderFooter({});
    expect(html).toContain('href="/pricing"');
    expect(html).toContain('href="/terms"');
  });

  it("offers Manage or cancel membership only when the portal link is set", async () => {
    expect(await renderFooter({})).not.toContain("Manage or cancel membership");
    const html = await renderFooter(SETTINGS);
    expect(html).toContain(`<a href="${SETTINGS.NEXT_PUBLIC_STRIPE_PORTAL_LINK}"`);
    expect(html).toContain("Manage or cancel membership");
    // A link that isn't Stripe's is never shown.
    expect(await renderFooter({ NEXT_PUBLIC_STRIPE_PORTAL_LINK: "https://example.com/p" })).not.toContain(
      "Manage or cancel membership",
    );
  });
});

describe("the sitemap", () => {
  it("lists /pricing and /terms but not the thank-you pages", async () => {
    const { default: sitemap } = await import("../sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://capexclock.com/pricing");
    expect(urls).toContain("https://capexclock.com/terms");
    expect(urls.some((u) => u.includes("/thanks"))).toBe(false);
  });
});

describe("our own words (plan T5)", () => {
  // The live pay question keeps its original wording, so it's left out.
  const KEEPS_OLD_WORDING = new Set(["src/components/export/PayQuestion.tsx"]);
  const root = join(__dirname, "../../..");

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
      return /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  }

  it("never call the report lender-ready or accepted by lenders, or show $12 as a discount", () => {
    for (const path of sourceFiles(join(root, "src"))) {
      const file = relative(root, path);
      if (KEEPS_OLD_WORDING.has(file)) continue;
      // Comments may name the rules.
      const source = readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect([file, /lender-ready|accepted by lenders/i.test(source)]).toEqual([file, false]);
      expect([file, /normally \$19|locked for life|line-through|<s>|<del>/i.test(source)]).toEqual([file, false]);
    }
  });

  it("never promise what we'll build next, since only the idea that wins gets built", () => {
    for (const path of sourceFiles(join(root, "src"))) {
      const file = relative(root, path);
      const source = readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect([file, /(we(&apos;|')re|we are) building|coming next|coming soon/i.test(source)]).toEqual([file, false]);
    }
  });
});
