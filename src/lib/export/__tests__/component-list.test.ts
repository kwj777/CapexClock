import Papa from "papaparse";
import { exampleDraft, type DraftRow } from "@/components/calculator/draft";
import { FORMAT_HEADINGS } from "@/lib/import/format";
import { componentListCsv, EXAMPLE_BUILDING, exampleCsv, exampleRows, templateCsv } from "../component-list";
import { componentListFileName } from "../csv";

function table(csv: string): string[][] {
  expect(csv.startsWith("﻿")).toBe(true);
  expect(csv.endsWith("\r\n")).toBe(true);
  const result = Papa.parse<string[]>(csv.slice(1).trimEnd(), { delimiter: "," });
  expect(result.errors).toEqual([]);
  return result.data;
}

const row = (over: Partial<DraftRow> = {}): DraftRow => ({
  id: "1b4e28ba-2fa1-11d2-883f-0016d3cca427",
  librarySlug: "tank-water-heater",
  category: "Plumbing",
  name: "Tank water heater",
  quantity: "12",
  unitLabel: "per_unit",
  installYear: "2016",
  usefulLife: "10",
  costEach: "$1,400",
  scenario: "run_to_failure",
  ...over,
});

describe("the blank template", () => {
  it("is the headings and nothing else, with a byte-order mark so Excel reads it as UTF-8", () => {
    expect(table(templateCsv())).toEqual([[...FORMAT_HEADINGS]]);
  });
});

describe("the filled-in example", () => {
  const rows = table(exampleCsv());

  it("has a row for every component of the calculator's example, with the building on each", () => {
    expect(rows).toHaveLength(exampleDraft().rows.length + 1);
    for (const r of rows.slice(1)) {
      expect(r.slice(0, 3)).toEqual([EXAMPLE_BUILDING.name, "12", "1998"]);
      expect(r).toHaveLength(FORMAT_HEADINGS.length);
    }
  });

  it("shows the condition, notes, guess and replace now columns in use, and has no CapexClock IDs", () => {
    const col = (heading: string) => FORMAT_HEADINGS.indexOf(heading);
    const body = rows.slice(1);
    expect(body.some((r) => r[col("Condition")] !== "")).toBe(true);
    expect(body.some((r) => r[col("Notes")] !== "")).toBe(true);
    expect(body.some((r) => r[col("Install year is a guess")] === "yes")).toBe(true);
    expect(body.some((r) => r[col("Replace now")] === "yes")).toBe(true);
    expect(body.every((r) => r[col("CapexClock ID")] === "")).toBe(true);
    expect(new Set(body.map((r) => r[col("Counted per")]))).toEqual(new Set(["unit", "building", "sq ft"]));
  });

  it("leaves Quantity blank on the rows counted per unit, so they follow a changed Units column", () => {
    const [quantity, counted] = ["Quantity", "Counted per"].map((h) => FORMAT_HEADINGS.indexOf(h));
    for (const r of rows.slice(1)) expect(r[quantity] === "").toBe(r[counted] === "unit");
  });

  it("matches the rows the template page shows", () => {
    expect(rows.slice(1).map((r) => r[3])).toEqual(exampleRows().map((r) => r.name));
  });
});

describe("the component list download", () => {
  it("writes each row in our columns, numbers plainly, with its CapexClock ID", () => {
    const csv = componentListCsv({ name: "Maple Court", unitCount: "1,200", yearBuilt: "1998" }, [
      row({ condition: "fair", notes: "40 gallon\ngas", installYearIsGuess: true, scenario: "replace_now" }),
    ]);
    expect(table(csv)[1]).toEqual([
      "Maple Court",
      "1200",
      "1998",
      "Tank water heater",
      "Plumbing",
      "12",
      "unit",
      "2016",
      "yes",
      "10",
      "1400",
      "Fair",
      "yes",
      "40 gallon\ngas",
      "1b4e28ba-2fa1-11d2-883f-0016d3cca427",
    ]);
  });

  it("leaves Quantity blank on a row that follows the unit count, which means the unit count", () => {
    const building = { name: "", unitCount: "12", yearBuilt: "1998" };
    const quantity = (r: DraftRow) => table(componentListCsv(building, [r]))[1][5];
    expect(quantity(row({ followsUnitCount: true }))).toBe("");
    // A count the owner typed is written, even when it's the unit count.
    expect(quantity(row({ followsUnitCount: false }))).toBe("12");
    expect(quantity(row({ quantity: "1,400", unitLabel: "per_sq_ft", followsUnitCount: false }))).toBe("1400");
  });

  it("leaves the Building column blank in the public calculator, and guards formulas", () => {
    const csv = componentListCsv({ name: "", unitCount: "", yearBuilt: "" }, [row({ name: "=HYPERLINK(\"x\")", costEach: "call" })]);
    const [, line] = table(csv);
    expect(line[0]).toBe("");
    expect(line[3]).toBe("'=HYPERLINK(\"x\")");
    expect(line[10]).toBe("call");
  });

  it("is named after the property", () => {
    expect(componentListFileName("Maple Court", "csv")).toBe("maple-court-component-list.csv");
    expect(componentListFileName("Maple Court", "xlsx")).toBe("maple-court-component-list.xlsx");
    expect(componentListFileName("", "xlsx")).toBe("capexclock-component-list.xlsx");
  });
});
