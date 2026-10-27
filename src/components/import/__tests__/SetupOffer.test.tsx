import { renderToStaticMarkup } from "react-dom/server";
import { SETUP_OFFER, setupOfferHref } from "@/lib/setup-offer";
import SetupOffer from "../SetupOffer";

// The first render only: the click's event is checked in the browser.

describe("done-for-you import offer", () => {
  it("links to our address with the subject filled in", () => {
    expect(setupOfferHref("support@capexclock.com")).toBe(
      "mailto:support@capexclock.com?subject=Set%20up%20my%20buildings",
    );
  });

  it("shows the offer, the mail link and the privacy link", () => {
    const html = renderToStaticMarkup(<SetupOffer where="template_page" />);
    expect(html).toContain(SETUP_OFFER.heading);
    expect(html).toContain('href="mailto:support@capexclock.com?subject=Set%20up%20my%20buildings"');
    expect(html).toContain("delete tenant names");
    expect(html).toContain("We reply within 2 business days with a file you can import.");
    expect(html).toContain("Copy the address");
    expect(html).toContain('href="/privacy"');
    // No price until the first batch is done.
    expect(html).not.toMatch(/\$\d/);
  });
});
