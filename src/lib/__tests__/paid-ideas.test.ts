import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FIRST_PICKS,
  firstTimeEach,
  IDEA_FOR_OFFER,
  NOT_BUILT_TEXT,
  OFFERS,
  offerForIdea,
  offerHeading,
  PAID_IDEA_TEXT,
  PAID_IDEAS,
  PAID_INTEREST_FORM,
  paidIdeaEvent,
  paidInterestBody,
  panelName,
  PHOTO_OFFER,
  photoOfferHref,
  testButtonsOn,
  UNIT_OPTIONS,
  validatePaidInterest,
} from "../paid-ideas";

describe("testButtonsOn", () => {
  it("shows the buttons unless the setting says off", () => {
    expect(testButtonsOn(undefined)).toBe(true);
    expect(testButtonsOn("")).toBe(true);
    expect(testButtonsOn("on")).toBe(true);
    expect(testButtonsOn("yes")).toBe(true);
  });

  it("hides them for off, however it's typed", () => {
    for (const value of ["off", "OFF", " Off ", "false", "no", "0"]) expect(testButtonsOn(value)).toBe(false);
  });
});

describe("validatePaidInterest", () => {
  it("accepts an email and a unit count from the list", () => {
    expect(validatePaidInterest({ email: "owner@example.com", units: "5–20" })).toEqual({});
    expect(validatePaidInterest({ email: "  owner@example.com ", units: "100+" })).toEqual({});
  });

  it("asks for a missing or mistyped email", () => {
    expect(validatePaidInterest({ email: " ", units: "5–20" })).toEqual({ email: "Enter your email." });
    for (const email of ["owner", "owner@", "owner@example", "own er@example.com"]) {
      expect(validatePaidInterest({ email, units: "5–20" }).email).toBe("Enter an email like you@example.com.");
    }
  });

  it("asks for a unit count from the list", () => {
    expect(validatePaidInterest({ email: "owner@example.com", units: "" })).toEqual({
      units: "Choose how many units you own.",
    });
    // A hyphen in place of the dash isn't one of the choices Netlify registered.
    expect(validatePaidInterest({ email: "owner@example.com", units: "5-20" }).units).toBeDefined();
  });

  it("reports both at once", () => {
    expect(Object.keys(validatePaidInterest({ email: "", units: "" })).sort()).toEqual(["email", "units"]);
  });
});

describe("paidInterestBody", () => {
  it("posts every field Netlify registered, with the email trimmed", () => {
    const body = paidInterestBody({ email: " owner@example.com ", units: "21–50", idea: "report", where: "property" });
    expect(Object.fromEntries(body)).toEqual({
      "form-name": "paid-interest",
      "bot-field": "",
      email: "owner@example.com",
      units: "21–50",
      idea: "report",
      where: "property",
    });
  });

  it("keeps the honeypot's value, so Netlify can catch the bot", () => {
    const body = paidInterestBody({ email: "a@b.co", units: "1–4", idea: "photo", where: "calculator", botField: "spam" });
    expect(body.get("bot-field")).toBe("spam");
  });
});

describe("paid idea events", () => {
  it("carry the idea and the page only", () => {
    expect(paidIdeaEvent("reminders", "calculator")).toEqual({ idea: "reminders", where: "calculator" });
  });

  it("go once per idea", () => {
    const first = firstTimeEach();
    expect(first("reminders")).toBe(true);
    // The second reminders button on the same page.
    expect(first("reminders")).toBe(false);
    expect(first("report")).toBe(true);
    expect(first("report")).toBe(false);
    // A new page view starts over.
    expect(firstTimeEach()("reminders")).toBe(true);
  });
});

describe("wording", () => {
  it("says the ideas aren't built yet", () => {
    expect(NOT_BUILT_TEXT).toBe("Not built yet. We're deciding what to build next.");
  });

  it("uses the approved button words", () => {
    expect(PAID_IDEA_TEXT.reminders.button).toBe("Email me before these are due");
    expect(PAID_IDEA_TEXT.report.button).toBe("Condition report for lenders and buyers");
    expect(PAID_IDEA_TEXT.photo.button).toBe("Add from a photo of the label");
  });

  it("never promises what lenders will accept", () => {
    for (const idea of PAID_IDEAS) {
      const text = `${PAID_IDEA_TEXT[idea].button} ${PAID_IDEA_TEXT[idea].pitch}`;
      expect(text).not.toMatch(/lender-ready|accepted by lenders|—/i);
    }
  });

  it("names each panel after its idea, so screen readers can tell them apart", () => {
    expect(PAID_IDEAS.map((idea) => panelName(idea))).toEqual([
      "Email me before these are due: not built yet",
      "Condition report for lenders and buyers: not built yet",
      "Add from a photo of the label: not built yet",
    ]);
  });

  it("heads a panel with the offer and its price, not 'not built yet', once it's on sale", () => {
    expect(offerHeading("membership")).toBe("Founding membership, $12/month");
    expect(offerHeading("report")).toBe("Condition report, $29 once");
    expect(panelName("reminders", "membership")).toBe("Email me before these are due: Founding membership, $12/month");
    expect(panelName("report", "report")).toBe("Condition report for lenders and buyers: Condition report, $29 once");
  });

  it("signs up for the matching idea from an offer that isn't on sale", () => {
    for (const offer of OFFERS) expect(offerForIdea(IDEA_FOR_OFFER[offer])).toBe(offer);
  });

  it("offers to read an emailed photo and reply with what to enter, free, with a subject line", () => {
    expect(`${PHOTO_OFFER.before} support@capexclock.com ${PHOTO_OFFER.after}`).toBe(
      "Want it now? Email a photo of the label to support@capexclock.com and we'll email back the install year, size and model to enter, free.",
    );
    expect(photoOfferHref("support@capexclock.com")).toBe("mailto:support@capexclock.com?subject=Photo%20of%20a%20label");
    expect(`${PHOTO_OFFER.before} ${PHOTO_OFFER.after}`).not.toMatch(/—/);
  });

  it("offers each idea, and something else, as a first pick", () => {
    expect(FIRST_PICKS.map((p) => p.value)).toEqual([...PAID_IDEAS, "other"]);
    expect(FIRST_PICKS.map((p) => p.label)).toEqual(["Reminders", "Condition report", "Photo entry", "Something else"]);
  });
});

describe("public/__forms.html", () => {
  const html = readFileSync(join(__dirname, "../../../public/__forms.html"), "utf8");
  const form = html.match(new RegExp(`<form name="${PAID_INTEREST_FORM}"[\\s\\S]*?</form>`))?.[0] ?? "";

  it("registers the paid-interest form with the honeypot", () => {
    expect(form).toContain('data-netlify="true"');
    expect(form).toContain('netlify-honeypot="bot-field"');
    expect(form).toContain(`<input type="hidden" name="form-name" value="${PAID_INTEREST_FORM}" />`);
  });

  it("has every field the app posts", () => {
    const names = [...form.matchAll(/name="([^"]+)"/g)].map((m) => m[1]).filter((n) => n !== PAID_INTEREST_FORM);
    const posted = [...paidInterestBody({ email: "a@b.co", units: "1–4", idea: "photo", where: "calculator" }).keys()];
    expect(names.sort()).toEqual(posted.sort());
  });

  it("offers the same unit choices as the app", () => {
    const select = form.match(/<select name="units">[\s\S]*?<\/select>/)?.[0] ?? "";
    const values = [...select.matchAll(/value="([^"]+)"/g)].map((m) => m[1]);
    expect(values).toEqual([...UNIT_OPTIONS]);
  });
});
