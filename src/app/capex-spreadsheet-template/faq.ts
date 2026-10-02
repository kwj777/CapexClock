/** The template page's questions, shown on the page and given to search engines as FAQPage data. */
export const FAQ: readonly { q: string; a: string }[] = [
  {
    q: "What should a CapEx spreadsheet track?",
    a: "Every big item you'll have to replace: roof, furnaces or boilers, water heaters, appliances, flooring, windows, paving. For each, track how many there are, when it was installed, how long it lasts and what a replacement costs today. That's enough to see what's due each year and how much to set aside each month.",
  },
  {
    q: "Do I have to use these exact columns?",
    a: "No. The importer reads most landlord spreadsheets, with headings like Item, Qty, Year installed or Cost, and lets you check each guess before anything is added. A sheet in these columns imports without any questions.",
  },
  {
    q: "What if I don't know when something was installed?",
    a: "Leave Install year blank and fill in Year built. The calculator uses the year built and marks the item as an estimate. If you have a rough idea, type your best guess and put yes in Install year is a guess, so you know which dates to check first.",
  },
  {
    q: "What do I put in Counted per?",
    a: "Use unit when the cost is for one apartment's worth, like a water heater in each unit. Leave its quantity blank to use the building's unit count. Use building when it's for the whole building, like the roof. Use sq ft for flooring and paving, with the square feet as the quantity. A replacement costs the quantity times the cost each.",
  },
  {
    q: "Can one spreadsheet hold several buildings?",
    a: "Yes. Put each building's name in the Building column, or give each building its own tab. The free calculator imports one building at a time. With a free account, My properties can make a property of each building, up to 20 at once.",
  },
  {
    q: "How do I update my list later?",
    a: "In the calculator, click Download component list (CSV). Change it in any spreadsheet app, then import it again. Rows keep their CapexClock ID, so they're updated in place instead of added twice. Rows you deleted from the file are only removed if you say so.",
  },
  {
    q: "Is my spreadsheet uploaded anywhere?",
    a: "No. Excel and CSV files are read in your browser and never uploaded. The rows stay in this browser until you save them to an account.",
  },
];

/** The same questions and answers as the page shows, as schema.org FAQPage data. */
export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
