import { renderToStaticMarkup } from "react-dom/server";
import { COMPONENT_LIBRARY, TYPICAL_COSTS } from "@/lib/library/components";
import { TICKED_BY_DEFAULT } from "@/lib/reserve/quick-estimate";
import QuickEstimate from "../QuickEstimate";
import ReserveTabs from "../ReserveTabs";
import { ENTER_PROMPT } from "../estimate-text";

// The first render only, as the page is built: typing and ticking are checked in the browser.

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("the quick estimate as the page is built", () => {
  const html = renderToStaticMarkup(<QuickEstimate library={COMPONENT_LIBRARY} typicalCosts={TYPICAL_COSTS} />);

  it("lists every system with its typical cost, lifespan and source", () => {
    const page = text(html);
    for (const c of COMPONENT_LIBRARY) expect(page).toContain(c.name);
    expect(page).toContain("$2,600–$4,700 per apartment");
    expect(page).toContain("$3–$6 per sq ft, 800 sq ft per apartment");
    expect(page).toContain("$0.15–$0.30 per sq ft, 500 sq ft per apartment");
    expect(page).toContain("20–25 yrs");
    expect(page).toContain("Source: HomeAdvisor");
    expect(page).toMatch(/Sources: Fixr \(opens in a new tab\) , HomeAdvisor/);
  });

  it("shows how each cost was worked out from its source", () => {
    const page = text(html);
    expect(page).toContain("Based on 8 windows × $400–$900");
    expect(page).toContain("Based on 7,000 sq ft of roof × $4.50–$8, old shingles removed, ÷ 12 apartments");
    expect(page).toContain("Based on one 300,000–600,000 BTU boiler at $13,000–$35,000, ÷ 12 apartments");
    expect(page).toContain("Based on 20 ft of stock cabinets × $100–$300 per ft");
    expect(page).toContain("Based on 30 sq ft × $15–$40, plus $50–$300 to remove the old top");
    expect(page).toContain("Based on $3,000–$10,000 for a new panel, installed and programmed, ÷ 12 apartments");
  });

  it("leaves out the working for a cost edited in the dashboard, since it no longer matches", () => {
    const edited = TYPICAL_COSTS.map((c) => (c.slug === "vinyl-windows" ? { ...c, low: 4000, high: 8000 } : c));
    const page = text(renderToStaticMarkup(<QuickEstimate library={COMPONENT_LIBRARY} typicalCosts={edited} />));
    expect(page).toContain("$4,000–$8,000 per apartment");
    expect(page).not.toContain("8 windows");
    expect(page).toContain("Based on 7,000 sq ft of roof");
  });

  it("starts with the usual systems ticked", () => {
    const checked = [...html.matchAll(/<input type="checkbox"[^>]*?( checked="")?\/><span>([^<]+)<\/span>/g)];
    expect(checked).toHaveLength(COMPONENT_LIBRARY.length);
    const tickedNames = checked.filter((m) => m[1]).map((m) => m[2].replace(/&amp;/g, "&"));
    expect(tickedNames).toEqual(COMPONENT_LIBRARY.filter((c) => TICKED_BY_DEFAULT.has(c.slug)).map((c) => c.name));
  });

  it("asks for units and year built before showing a range, and points to the full calculator", () => {
    const page = text(html);
    expect(page).toContain(ENTER_PROMPT);
    expect(html).toContain('href="/capex-calculator"');
    expect(html).not.toContain("Save each month, per unit");
  });

  it("keeps a live region for the range, and labels each field", () => {
    expect(html).toContain('aria-live="polite"');
    expect(text(html)).toContain("Rental units");
    expect(text(html)).toContain("Year built");
    expect(html).toContain("Systems and their typical replacement costs");
  });
});

describe("the reserve calculator's tabs as the page is built", () => {
  const html = renderToStaticMarkup(<ReserveTabs panels={{ quick: <p>Quick panel</p>, expenses: <p>Expense panel</p> }} />);

  it("is a tab list with the quick estimate chosen and the expense list hidden", () => {
    expect(html).toContain('role="tablist"');
    const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*aria-selected="(true|false)"[^>]*tabindex="(-?\d)"[^>]*>([^<]+)</g)];
    expect(tabs.map((m) => [m[3], m[1], m[2]])).toEqual([
      ["Quick estimate", "true", "0"],
      ["List your expenses", "false", "-1"],
    ]);
    expect(html).toMatch(/role="tabpanel"[^>]*class="mt-4"><p>Quick panel/);
    expect(html).toMatch(/role="tabpanel"[^>]*hidden=""[^>]*><p>Expense panel/);
  });

  it("ties each tab to its panel", () => {
    const controls = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
    for (const id of controls) expect(html).toContain(`id="${id}" role="tabpanel"`);
  });
});
