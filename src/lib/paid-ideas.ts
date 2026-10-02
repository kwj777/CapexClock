// The paid ideas we're testing before building any of them (Phase 3). Each one
// has a button in the calculator and the property editor. The first click says
// it isn't built yet and offers a "tell me first" list (the Netlify form
// "paid-interest"). Events carry the idea and the page only, never the email
// or the unit count.

export const PAID_IDEAS = ["reminders", "report", "photo"] as const;
export type PaidIdea = (typeof PAID_IDEAS)[number];

/** The page a button sits on, sent with its events and with each sign-up. */
export type PaidWhere = "calculator" | "property";

export interface PaidIdeaText {
  /** The button's words. They start its accessible name, so "click Email me…" works by voice. */
  button: string;
  /** One line in the panel saying what the idea would do. */
  pitch: string;
}

// Our own words say "for lenders and buyers", never "accepted by lenders" or "lender-ready".
export const PAID_IDEA_TEXT: Record<PaidIdea, PaidIdeaText> = {
  reminders: {
    button: "Email me before these are due",
    pitch: "An email before each replacement comes due, plus a yearly budget summary and condition report.",
  },
  report: {
    button: "Condition report for lenders and buyers",
    pitch: "A condition report on your building, made from what you enter here, to share with lenders and buyers.",
  },
  photo: {
    button: "Add from a photo of the label",
    pitch: "Take a photo of the label on a water heater or furnace, and we fill in the row for you.",
  },
};

export const NOT_BUILT_TEXT = "Not built yet. We're deciding what to build next.";

/**
 * A panel's name for screen readers: which idea it's for, then that it isn't built,
 * so the reminders, report and photo panels can be told apart.
 */
export function panelName(idea: PaidIdea): string {
  return `${PAID_IDEA_TEXT[idea].button}: not built yet`;
}

/**
 * The photo idea's own test (plan section 2): until it's built, we fill in rows by
 * hand, free, from photos people email us. The photo panel says so around a mailto
 * link to our address.
 */
export const PHOTO_OFFER = {
  before: "Want it now? Email a photo of the label to",
  after: "and we'll fill in the row for you, free.",
  subject: "Photo of a label",
} as const;

/** The photo offer's mailto link, with the subject filled in. */
export function photoOfferHref(email: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(PHOTO_OFFER.subject)}`;
}

/** NEXT_PUBLIC_TEST_BUTTONS=off (or false, no, 0) hides every button. Anything else, or nothing, shows them. */
export function testButtonsOn(setting: string | undefined): boolean {
  return !["off", "false", "no", "0"].includes(setting?.trim().toLowerCase() ?? "");
}

// Field names and options must match the "paid-interest" form in
// public/__forms.html, the copy Netlify registers at deploy time.
export const PAID_INTEREST_FORM = "paid-interest";
export const FORMS_ACTION = "/__forms.html";

/** The same choices as the early-access form, so the two lists line up. */
export const UNIT_OPTIONS = ["1–4", "5–20", "21–50", "51–100", "100+"] as const;

export interface PaidInterestFields {
  email: string;
  units: string;
}

export type PaidInterestErrors = Partial<Record<keyof PaidInterestFields, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What's wrong with the form, field by field. Empty when it can be sent. */
export function validatePaidInterest({ email, units }: PaidInterestFields): PaidInterestErrors {
  const errors: PaidInterestErrors = {};
  const trimmed = email.trim();
  if (!trimmed) errors.email = "Enter your email.";
  else if (!EMAIL.test(trimmed)) errors.email = "Enter an email like you@example.com.";
  if (!(UNIT_OPTIONS as readonly string[]).includes(units)) errors.units = "Choose how many units you own.";
  return errors;
}

/** The form post Netlify expects, form-name included. The honeypot goes too, so bots still trip it. */
export function paidInterestBody(
  fields: PaidInterestFields & { idea: PaidIdea; where: PaidWhere; botField?: string },
): URLSearchParams {
  return new URLSearchParams({
    "form-name": PAID_INTEREST_FORM,
    "bot-field": fields.botField ?? "",
    email: fields.email.trim(),
    units: fields.units,
    idea: fields.idea,
    where: fields.where,
  });
}

/** Properties for paid_idea_seen, _clicked and _signup: labels only. */
export function paidIdeaEvent(idea: PaidIdea, where: PaidWhere): { idea: PaidIdea; where: PaidWhere } {
  return { idea, where };
}

/**
 * Returns a check that's true the first time it's asked about each idea, and
 * false after that, so an event goes once per page view however many buttons
 * an idea has (reminders has two).
 */
export function firstTimeEach(): (idea: PaidIdea) => boolean {
  const done = new Set<PaidIdea>();
  return (idea) => {
    if (done.has(idea)) return false;
    done.add(idea);
    return true;
  };
}

/** The follow-up to a Yes or Maybe on the pay question. */
export const FIRST_PICK_QUESTION = "Which would you use first?";

export const FIRST_PICKS = [
  { value: "reminders", label: "Reminders" },
  { value: "report", label: "Condition report" },
  { value: "photo", label: "Photo entry" },
  { value: "other", label: "Something else" },
] as const;
export type FirstPick = (typeof FIRST_PICKS)[number]["value"];

// Pre-orders (Phase 3 step 2). Two paid ideas can be bought through Stripe
// Payment Links, filled by hand. The app only links to Stripe; it holds no
// payment code and no keys. Each link comes from a Netlify setting, and an
// idea whose link is blank or invalid keeps its "tell me first" form.

export const OFFERS = ["membership", "report"] as const;
export type Offer = (typeof OFFERS)[number];

/** The offer each idea's panel sells. The photo idea has none. */
export const OFFER_FOR_IDEA: Readonly<Partial<Record<PaidIdea, Offer>>> = {
  reminders: "membership",
  report: "report",
};

export function offerForIdea(idea: PaidIdea): Offer | null {
  return OFFER_FOR_IDEA[idea] ?? null;
}

export function isOffer(value: string): value is Offer {
  return (OFFERS as readonly string[]).includes(value);
}

export interface OfferText {
  name: string;
  /** The price as a heading shows it. */
  price: string;
  /** Goes right next to every Buy now button. */
  priceNote: string;
  /** What it includes (on /pricing and /terms). */
  includes: string;
  /** How and when it's delivered (on /pricing and /terms). */
  delivery: string;
  /** The panel's line under "Not built yet". */
  pitch: string;
}

/** How the membership renews. Its price note adds "Cancel any time online." */
export const MEMBERSHIP_RENEWS_TEXT = "$12 every month until you cancel.";

// Price wording rules (plan T5): never a struck-through price, "normally $19"
// or "locked for life". $12 has never been a discount from anything. The
// report is "for lenders and buyers", never "lender-ready" or "accepted by lenders".
export const OFFER_TEXT: Record<Offer, OfferText> = {
  membership: {
    name: "Founding membership",
    price: "$12/month",
    priceNote: `${MEMBERSHIP_RENEWS_TEXT} Cancel any time online.`,
    includes:
      "An email from us before each replacement comes due, plus a yearly budget summary and a yearly condition report.",
    delivery: "We send them by hand for now.",
    pitch:
      "Founding members get it now, done by hand: an email from us before each replacement comes due, plus a yearly budget summary and a yearly condition report.",
  },
  report: {
    name: "Condition report",
    price: "$29 once",
    priceNote: "$29 once. No subscription.",
    includes:
      "A condition report on your building for lenders and buyers: each component's age, remaining life and condition, what's at risk, a 10-year forecast and a monthly reserve.",
    delivery: "Made by hand within 2 business days of getting your details.",
    pitch:
      "We make them by hand for now: a condition report on your building for lenders and buyers, ready within 2 business days of getting your details.",
  },
};

/** The founding price, said the one way it's allowed to be said. */
export const FOUNDING_PRICE_TEXT = "$12/month founding price, kept for as long as you stay a member.";

/** The founding promise, on /terms, /pricing and the membership panel. */
export const FOUNDING_PROMISE_TEXT =
  "If we don't build reminders, we cancel every founding membership and refund every payment in full.";

export const REFUND_TEXT = "Full refund within 30 days.";

/** On the cover of every condition report, and quoted on /terms. */
export const REPORT_LABEL =
  "Prepared by CapexClock from information the owner supplied. A planning document, not an inspection.";

/** The fixed sample report, made by scripts/sample-report.tsx. */
export const SAMPLE_REPORT_PATH = "/sample-condition-report.pdf";

export type StripeLinkKind = "payment" | "portal";

/** Payment Links live on buy.stripe.com, and the customer portal's login link on billing.stripe.com. */
const STRIPE_HOSTS: Record<StripeLinkKind, string> = {
  payment: "buy.stripe.com",
  portal: "billing.stripe.com",
};

/**
 * The link from a Netlify setting, or null when it's blank or not a Stripe
 * link of that kind: only https, only Stripe's own host, no login details or
 * port, and a path after the host. `warn` hears why a non-blank one was refused.
 */
export function stripeLink(
  setting: string | undefined,
  kind: StripeLinkKind,
  warn: (message: string) => void = () => {},
): string | null {
  const value = setting?.trim() ?? "";
  if (!value) return null;
  const expected = STRIPE_HOSTS[kind];
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    warn(`"${value}" isn't a web address. Paste the whole https://${expected}/… link.`);
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== expected || url.username || url.password || url.port) {
    warn(`"${value}" isn't an https://${expected}/ link, so it's ignored.`);
    return null;
  }
  if (url.pathname.length <= 1) {
    warn(`"${value}" has nothing after ${expected}/. Paste the whole link from Stripe.`);
    return null;
  }
  return url.href;
}

/** Stripe's test-mode links have a path part starting "test_". Nothing is charged through them. */
export function isTestLink(link: string): boolean {
  return new URL(link).pathname.split("/").some((part) => part.startsWith("test_"));
}

export interface PresaleLinks {
  /**
   * Payment Link for each offer; null keeps the "tell me first" form. The
   * membership's needs the portal link too, from the same Stripe mode.
   */
  offers: Record<Offer, string | null>;
  /** The customer portal's login link, where members cancel. Null when not set. */
  portal: string | null;
}

export interface PresaleSettings {
  membership?: string;
  report?: string;
  portal?: string;
}

const mode = (link: string) => (isTestLink(link) ? "a test-mode" : "a live");

/**
 * Why the membership link can't be used with this portal link, or null when
 * it can. A test-mode portal can't find live members, nor a live one test members.
 */
function membershipProblem(membership: string, portal: string | null): string | null {
  if (!portal) {
    return (
      "NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP is ignored until NEXT_PUBLIC_STRIPE_PORTAL_LINK is set to the customer " +
      "portal's login link (https://billing.stripe.com/p/login/…), so members can cancel online. " +
      "The membership isn't on sale."
    );
  }
  if (isTestLink(membership) !== isTestLink(portal)) {
    return (
      "NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP and NEXT_PUBLIC_STRIPE_PORTAL_LINK are from different Stripe modes " +
      `(test and live): the membership link is ${mode(membership)} link, and the portal link is ${mode(portal)} ` +
      "link. Paste both from the same mode, so members can cancel in the portal that has their membership. " +
      "The membership isn't on sale."
    );
  }
  return null;
}

/**
 * Checks the three settings. Refused ones count as blank; `warn` says why.
 * The membership renews every month and promises "Cancel any time online"
 * next to its Buy now, so it goes on sale only when the portal link, where
 * members cancel, is valid too and from the same Stripe mode (test or live).
 * Otherwise the reminders panel keeps its form.
 */
export function presaleLinks(settings: PresaleSettings, warn?: (message: string) => void): PresaleLinks {
  const named = (name: string) => (message: string) => warn?.(`${name}: ${message}`);
  const membership = stripeLink(settings.membership, "payment", named("NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP"));
  const report = stripeLink(settings.report, "payment", named("NEXT_PUBLIC_STRIPE_LINK_REPORT"));
  const portal = stripeLink(settings.portal, "portal", named("NEXT_PUBLIC_STRIPE_PORTAL_LINK"));
  const problem = membership && membershipProblem(membership, portal);
  if (problem) warn?.(problem);
  return { offers: { membership: problem ? null : membership, report }, portal };
}

/** `next build` sets this in the processes that render the pages. */
const BUILD_PHASE = "phase-production-build";

const warned = new Set<string>();

/**
 * Where a refused link is reported: the terminal in development, and the
 * build output (the Netlify deploy log) during `next build`. Each message
 * once per process, since several modules read the settings. Nothing is
 * printed on the live site.
 */
function settingsWarning(): ((message: string) => void) | undefined {
  if (process.env.NODE_ENV !== "development" && process.env.NEXT_PHASE !== BUILD_PHASE) return undefined;
  return (message) => {
    if (warned.has(message)) return;
    warned.add(message);
    console.warn(`[CapexClock] ${message}`);
  };
}

/**
 * The links this build was made with (they're baked in at build time). Each
 * setting is named in full so Next can put its value in the browser code.
 */
export function presaleLinksFromEnv(): PresaleLinks {
  return presaleLinks(
    {
      membership: process.env.NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP,
      report: process.env.NEXT_PUBLIC_STRIPE_LINK_REPORT,
      portal: process.env.NEXT_PUBLIC_STRIPE_PORTAL_LINK,
    },
    settingsWarning(),
  );
}

export interface BuyNowClick {
  /** This tab was just sent to Stripe, so this is a double click. */
  leaving: boolean;
  /** presale_checkout_clicked already went for this offer since the page was last shown. */
  counted: boolean;
  /**
   * A middle, Ctrl, Cmd, Shift or Alt click, which opens Stripe in a new tab or window
   * (BuyNow hears a middle click as auxclick). "Open in new tab" from the right-click
   * menu sends no event, so it isn't counted.
   */
  newTab: boolean;
}

/**
 * What a click on Buy now does: "ignore" it, let the browser open a new tab,
 * or "go" to Stripe in this tab. `send` says whether it sends
 * presale_checkout_clicked: once per trip to Stripe. A click whose "leave
 * page?" prompt was canceled leaves the page here, so the next one doesn't
 * count again. A new tab is a trip of its own.
 */
export function buyNowClick({ leaving, counted, newTab }: BuyNowClick): {
  step: "ignore" | "new-tab" | "go";
  send: boolean;
} {
  if (leaving) return { step: "ignore", send: false };
  if (newTab) return { step: "new-tab", send: true };
  return { step: "go", send: !counted };
}

/** Properties for presale_checkout_clicked and presale_completed: the offer only. */
export function presaleEvent(offer: Offer): { offer: Offer } {
  return { offer };
}

const COMPLETED_KEY = "capexclock:presale-completed:";

/**
 * True the first time a thank-you page asks in this visit (this tab's session),
 * so a reload doesn't count the sale twice. With storage blocked it can't
 * tell, so it says true.
 */
export function firstCompletionThisVisit(offer: Offer, storage: () => Pick<Storage, "getItem" | "setItem">): boolean {
  try {
    const store = storage();
    if (store.getItem(COMPLETED_KEY + offer)) return false;
    store.setItem(COMPLETED_KEY + offer, "1");
  } catch {
    // Storage blocked: count it.
  }
  return true;
}
