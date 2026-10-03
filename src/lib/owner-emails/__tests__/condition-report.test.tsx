import { join } from "node:path";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import type { SavedProperty, SavedReportComponent } from "@/verticals/landlord";
import { conditionReportBuilder, fileSlug } from "../condition-report";

// @react-pdf/renderer is ES modules only, which Jest here can't load; the real render
// is checked by bundling the function (see the PR). Here it stands in for it.
jest.mock("@react-pdf/renderer", () => ({
  Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
  renderToBuffer: jest.fn(async () => Buffer.from("%PDF-1.3 stand-in")),
  Document: "Document",
  Page: "Page",
  Text: "Text",
  View: "View",
  StyleSheet: { create: <T,>(s: T) => s },
}));

const FONTS = {
  regular: join(__dirname, "../../../../public/fonts/DejaVuSans.ttf"),
  bold: join(__dirname, "../../../../public/fonts/DejaVuSans-Bold.ttf"),
};
const FOOTER = { kind: "condition_report" as const, unsubscribeUrl: "https://capexclock.com/email/unsubscribe?t=x&k=condition_report" };

const ROOF: SavedReportComponent = {
  id: "c1",
  property_id: "p1",
  category: "Roof",
  name: "Asphalt shingle roof",
  quantity: 1,
  install_year: 2008,
  useful_life_years: 20,
  replacement_cost_each: 14000,
  scenario: "run_to_failure",
  unit_label: "per_building",
  condition: "fair",
  notes: "Some granule loss.",
};

const props = (id: string, name: string, year_built: number | null): SavedProperty => ({ id, name, unit_count: 6, year_built });

it("makes a PDF per property it can report on", async () => {
  const build = conditionReportBuilder(FONTS, () => new Date("2027-01-08T15:00:00Z"));
  const result = await build(
    {
      properties: [props("p1", "Elm St #2", null), props("p2", "Elm St #2", 1990), props("p3", "Empty", 2000)],
      components: [ROOF, { ...ROOF, id: "c2", property_id: "p2", condition: null }],
    },
    2027,
    FOOTER,
  );
  expect(result).not.toBeNull();
  expect(result!.subject).toBe("Your 2027 condition reports");
  expect(result!.attachments.map((a) => a.filename)).toEqual([
    "elm-st-2-condition-report-2027.pdf",
    "elm-st-2-2-condition-report-2027.pdf",
  ]);
  const pdf = Buffer.from(result!.attachments[0].content, "base64");
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(renderToBuffer).toHaveBeenCalledTimes(2);
  const [first] = (renderToBuffer as jest.Mock).mock.calls[0];
  expect(first.props).toMatchObject({ propertyName: "Elm St #2", yearBuilt: null, preparedOn: "January 8, 2027", informationAsOf: "January 2027" });
  expect(Font.register).toHaveBeenCalledWith({
    family: "DejaVu Sans",
    fonts: [{ src: FONTS.regular }, { src: FONTS.bold, fontWeight: 700 }],
  });
  expect(result!.text).toContain("- Elm St #2: 1 at risk (https://capexclock.com/app/properties/p1)");
  expect(result!.text).toContain("1 without a condition rating");
  expect(result!.text).not.toContain("Empty");
}, 30_000);

it("returns null when no property can be reported on", async () => {
  const build = conditionReportBuilder(FONTS);
  await expect(build({ properties: [props("p3", "Empty", 2000)], components: [] }, 2027, FOOTER)).resolves.toBeNull();
});

it("makes safe file names", () => {
  expect(fileSlug("Café on 5th — Unit A")).toBe("cafe-on-5th-unit-a");
  expect(fileSlug("!!!")).toBe("property");
});
