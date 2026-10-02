import { FIELD_TEXT, FIELDS } from "../columns";
import { FORMAT_COLUMNS, FORMAT_HEADINGS, formatField, isCapexClockFormat, isForecastCsv } from "../format";
import { match } from "../__fixtures__/sheets";

describe("CapexClock's own columns", () => {
  it("are the plan's list, in order", () => {
    expect(FORMAT_HEADINGS).toEqual([
      "Building",
      "Units",
      "Year built",
      "Component",
      "Category",
      "Quantity",
      "Counted per",
      "Install year",
      "Install year is a guess",
      "Useful life",
      "Cost each",
      "Condition",
      "Replace now",
      "Notes",
      "CapexClock ID",
    ]);
  });

  it("each read as a different field the importer offers", () => {
    const fields = FORMAT_COLUMNS.map((c) => c.field);
    expect(new Set(fields).size).toBe(fields.length);
    for (const f of fields) {
      expect(FIELDS).toContain(f);
      expect(FIELD_TEXT[f]).toBeTruthy();
    }
  });

  it("say what goes in each and why, in short plain sentences", () => {
    for (const c of FORMAT_COLUMNS) {
      expect(c.what).toMatch(/\.$/);
      expect(c.why).toMatch(/\.$/);
      expect(`${c.what} ${c.why}`).not.toMatch(/[–—]/);
    }
  });

  it("give example names the import knows, and say when it asks about a short one", () => {
    const component = FORMAT_COLUMNS.find((c) => c.field === "item");
    const named = component?.what.replace(/^What it is, like /, "").replace(/\.$/, "").split(/, | or /) ?? [];
    expect(named).toEqual(["Asphalt shingle roof", "Water heater", "Furnace", "Refrigerator"]);
    for (const name of named) expect(["exact", "matched"]).toContain(match(name).kind);
    expect(match("Roof").kind).toBe("unsure");
    expect(component?.why).toContain("For a short name like Roof, the import asks which kind.");
  });

  it("are known by headings no one else's sheet has, in any case", () => {
    expect(isCapexClockFormat(["Component", "CAPEXCLOCK ID"])).toBe(true);
    expect(isCapexClockFormat(["Item", "counted per"])).toBe(true);
    expect(isCapexClockFormat(["Item", "Install Year Is A Guess"])).toBe(true);
    expect(isCapexClockFormat(["Item", "Units", "Year built", "Notes"])).toBe(false);
  });

  it("map a heading to its field, ignoring case and punctuation", () => {
    expect(formatField("Units")).toBe("unitCount");
    expect(formatField("install year is a guess")).toBe("guess");
    expect(formatField("Capexclock ID")).toBe("id");
    expect(formatField("Tenant")).toBeNull();
  });

  it("are told apart from the forecast download, which can't be read back", () => {
    const forecast = ["Year", "Component", "Category", "Quantity", "Unit", "Cost each", "Total cost", "Forecast note", "Condition", "Notes"];
    expect(isForecastCsv(forecast)).toBe(true);
    expect(isForecastCsv([...FORMAT_HEADINGS])).toBe(false);
    expect(isForecastCsv(["Year", "Item", "Total cost"])).toBe(false);
  });

  it("know the forecast download owners already have, from before condition and notes were added", () => {
    // The live site's forecast CSV before Phase 3, heading for heading.
    const before = ["Year", "Component", "Category", "Quantity", "Unit", "Cost each", "Total cost", "Note"];
    expect(isForecastCsv(before)).toBe(true);
    // Saved again from Excel with the headings in other cases, or with Category taken out.
    expect(isForecastCsv(before.map((h) => h.toUpperCase()))).toBe(true);
    expect(isForecastCsv(before.filter((h) => h !== "Category"))).toBe(true);
  });

  it("don't take an owner's own sheet with a year and a total for the forecast download", () => {
    expect(isForecastCsv(["Unit", "Component", "Year", "Cost each", "Total cost", "Notes"])).toBe(false);
    expect(isForecastCsv(["Year", "Component", "Quantity", "Cost each", "Total cost", "Note"])).toBe(false);
    expect(isForecastCsv(["Item", "Qty", "Unit", "Year", "Cost each", "Total cost", "Note"])).toBe(false);
  });
});
