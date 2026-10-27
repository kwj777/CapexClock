import { renderToStaticMarkup } from "react-dom/server";
import BuyNow from "../BuyNow";
import PresaleOffer from "../PresaleOffer";

// What a panel shows once its Stripe link is set. Opening the panel and the
// click event are checked in the browser.

const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");

describe("Buy now", () => {
  const html = renderToStaticMarkup(<BuyNow offer="membership" link="https://buy.stripe.com/abc" />);

  it("is a plain link to the Payment Link, so it works before the script loads", () => {
    expect(html).toContain('href="https://buy.stripe.com/abc"');
    expect(html).not.toContain("target=");
  });

  it("names the offer for screen readers, starting with the visible words", () => {
    expect(html).toContain('aria-label="Buy now: Founding membership"');
    expect(html).toMatch(/>Buy now<\/a>/);
  });

  it("has the price note right next to it, and points to it", () => {
    const noteId = html.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(noteId).toBeTruthy();
    expect(html).toContain(`id="${noteId}"`);
    expect(text(html)).toContain("Buy now$12 every month until you cancel. Cancel any time online.");
  });

  it("says when a link is in Stripe's test mode", () => {
    expect(text(html)).not.toContain("test mode");
    const test = renderToStaticMarkup(<BuyNow offer="report" link="https://buy.stripe.com/test_abc" />);
    expect(text(test)).toContain("Stripe test mode: no real payment is taken.");
    expect(text(test)).toContain("$29 once. No subscription.");
  });
});

describe("the pre-order panel", () => {
  const membership = text(renderToStaticMarkup(<PresaleOffer offer="membership" link="https://buy.stripe.com/m" />));
  const report = text(renderToStaticMarkup(<PresaleOffer offer="report" link="https://buy.stripe.com/r" />));

  it("sells the founding membership with its price, refund and promise", () => {
    expect(membership).toContain("Founding members get it now, sent automatically");
    expect(membership).toContain("$12/month founding price, kept for as long as you stay a member.");
    expect(membership).toContain("$12 every month until you cancel. Cancel any time online.");
    expect(membership).toContain("Full refund within 30 days.");
    expect(membership).toContain("If we stop sending reminders, we cancel every founding membership");
  });

  it("sells the report for lenders and buyers, as a planning document, with a sample", () => {
    expect(report).toContain("a condition report on your building for lenders and buyers");
    expect(report).toContain("It's a planning document, not an inspection.");
    expect(report).toContain("See a sample report (PDF)");
    expect(report).not.toContain("founding");
  });

  it("links to the terms and pricing from both panels", () => {
    for (const offer of ["membership", "report"] as const) {
      const html = renderToStaticMarkup(<PresaleOffer offer={offer} link="https://buy.stripe.com/x" />);
      expect(html).toContain('href="/terms"');
      expect(html).toContain('href="/pricing"');
      expect(html).toContain("we never see your card number");
    }
  });
});
