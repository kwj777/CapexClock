import { renderToStaticMarkup } from "react-dom/server";
import type { LibraryComponent } from "@/lib/library/components";
import LifespanPage from "../[component]/page";
import LifespanIndex from "../page";

// Rows as they might be added in the Supabase dashboard.
const row = (slug: string, category: string, name: string): LibraryComponent => ({
  slug,
  category,
  name,
  lifeLow: 10,
  lifeHigh: 20,
  unitLabel: "per_building",
});
const mockLibrary: LibraryComponent[] = [
  row("striping", "Other", "Parking lot striping"),
  row("ups", "Other", "Uninterruptible power supply"),
  row("pool", "Constructor", "The pool"),
  row("proto", "__proto__", "Constructor"),
  row("to-string", "toString", "__proto__"),
];

jest.mock("@/lib/library/source", () => ({ getLibrary: async () => mockLibrary }));
jest.mock("@/components/lifespan/LifespanEstimator", () => () => null);

const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");
const renderPage = async (component: string) =>
  text(renderToStaticMarkup(await LifespanPage({ params: Promise.resolve({ component }), searchParams: Promise.resolve({}) })));

describe("lifespan pages for rows added in the dashboard", () => {
  it("groups categories named like built-in object properties", async () => {
    const html = text(renderToStaticMarkup(await LifespanIndex()));
    for (const category of ["Other", "Constructor", "__proto__", "toString"]) expect(html).toContain(category);
    for (const { name } of mockLibrary) expect(html).toContain(name);
  });

  it("reads grammatically and never says \"Other other\"", async () => {
    const striping = await renderPage("striping");
    expect(striping).toContain("How long does parking lot striping last?");
    expect(striping).toContain("More component lifespans");
    expect(striping).not.toMatch(/other other/i);
    expect(await renderPage("ups")).toContain("How long does an uninterruptible power supply last?");
    expect(await renderPage("pool")).toContain("How long does a pool last?");
    expect(await renderPage("proto")).toContain("How long does a constructor last?");
    expect(await renderPage("to-string")).toContain("How long does a __proto__ last?");
  });
});
