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
