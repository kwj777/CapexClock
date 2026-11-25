import { renderToStaticMarkup } from "react-dom/server";
import { COMPONENT_LIBRARY, TYPICAL_COSTS } from "@/verticals/landlord";
import LifespanChart from "../LifespanChart";
import { lifespanChartRows } from "../lifespan-chart";

// The first render only, as the page is built: sorting is checked in the browser.

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("the lifespan chart as the page is built", () => {
  const html = renderToStaticMarkup(<LifespanChart rows={lifespanChartRows(COMPONENT_LIBRARY, TYPICAL_COSTS)} />);

  it("lists every component in library order, each linked to its page", () => {
    const at = COMPONENT_LIBRARY.map((c) => html.indexOf(`href="/lifespan/${c.slug}"`));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it("shows each component's life, typical cost and source", () => {
    const page = text(html);
    expect(page).toContain("8–12 years");
    expect(page).toContain("$800–$2,300 per apartment Source: HomeAdvisor (opens in a new tab)");
    expect(page).toContain("$4.50–$8.00 per sq ft of roof, old shingles removed");
    expect(page).toContain("$0.15–$0.30 per sq ft Sources: HomeAdvisor (opens in a new tab) , SealMaster");
  });

  it("sorts by component, category and life, with nothing sorted until a heading is chosen", () => {
    expect(html).not.toContain("aria-sort");
    for (const label of ["Component", "Category", "Typical life"]) {
      expect(html).toMatch(new RegExp(`<button type="button"[^>]*>${label}<svg`));
    }
    // Cost doesn't sort: per apartment, per sq ft and per building can't be compared.
    expect(html).not.toMatch(/<button[^>]*>Replacement cost/);
  });

  it("says so when a component has no typical cost", () => {
    const blank = renderToStaticMarkup(<LifespanChart rows={lifespanChartRows(COMPONENT_LIBRARY, [])} />);
    expect(text(blank)).toContain("No typical cost listed");
    expect(blank).not.toContain("Source");
  });
});
