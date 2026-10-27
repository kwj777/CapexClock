// The done-for-you import offer: an owner emails us their spreadsheet and we send
// it back as a CapexClock file they import themselves. The click sends
// setup_offer_clicked with the page only, never anything from the sheet.

/** The page the offer sits on, sent with its event. */
export type SetupOfferWhere = "template_page" | "my_properties";

export const SETUP_OFFER = {
  heading: "Rather not do it yourself?",
  before: "Email your spreadsheet to",
  after:
    "and we'll set up your buildings for you, free for early users. Any layout works. Please delete tenant names first.",
  // As the thank-you pages say for the reports we make by hand.
  reply: "We reply within 2 business days with a file you can import.",
  subject: "Set up my buildings",
} as const;

/** The offer's mailto link, with the subject filled in. */
export function setupOfferHref(email: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(SETUP_OFFER.subject)}`;
}
