import { inflateRawSync } from "node:zlib";
import readExcelFile from "read-excel-file/universal";
import writeXlsxFile from "write-excel-file/universal";
import type { CellObject } from "write-excel-file/universal";
import { startingName } from "@/lib/import/buildings";
import { FORMAT_COLUMNS, FORMAT_HEADINGS } from "@/lib/import/format";
import { cellText } from "@/lib/import/text";
import { readWorkbook } from "@/lib/import/xlsx";
import { componentListGrid, exampleGrid, templateGrid, type ListGrid } from "../component-list";
import { exactNumber, LIST_SHEET_NAME, listSheet, listXlsx } from "../xlsx";

const column = (heading: string) => FORMAT_COLUMNS.findIndex((c) => c.heading === heading);

/** A list with one row, its cells set by heading. */
function oneRow(cells: Record<string, string>): ListGrid {
  return [FORMAT_HEADINGS.slice(), FORMAT_COLUMNS.map((c) => cells[c.heading] ?? "")];
}

describe("exactNumber", () => {
  it("reads plain numbers exactly as written", () => {
    expect(exactNumber("1998")).toBe(1998);
    expect(exactNumber("12")).toBe(12);
    expect(exactNumber("4.5")).toBe(4.5);
    expect(exactNumber("0.15")).toBe(0.15);
  });

  it("leaves anything else as text, so nothing the owner typed changes", () => {
    for (const text of ["", "approx 1998", "1,400", "$1400", "1e3", "4.50", "007", " 12", "12345678901234567890", "call"]) {
      expect(exactNumber(text)).toBeNull();
    }
  });
});

describe("listSheet", () => {
  const list = oneRow({
    Building: "123",
    Units: "12",
    "Year built": "1998",
    Component: "Asphalt shingle roof",
    Quantity: "1",
    "Counted per": "building",
    "Install year": "approx 2005",
    "Useful life": "25",
    "Cost each": "38000",
    Notes: "=SUM(A1) is a note\nA second, much longer line of the note that runs past forty characters",
  });
  const sheet = listSheet(list);
  const [headings, row] = sheet.data;

  it("is one tab called Sheet1, so a portfolio import names the property after the file, as it does for a CSV", () => {
    expect(sheet.sheet).toBe(LIST_SHEET_NAME);
    expect(startingName({ key: "", name: "", unitCount: null, yearBuilt: null, records: 1, notes: [] }, LIST_SHEET_NAME, "maple-court-component-list.xlsx")).toBe(
      "maple-court-component-list",
    );
  });

  it("has bold headings that stay in view", () => {
    expect(headings).toEqual(FORMAT_HEADINGS.map((value) => ({ value, type: String, fontWeight: "bold" })));
    expect(sheet.stickyRowsCount).toBe(1);
  });

  it("writes numbers as numbers in the number columns, with whole-dollar costs as 38,000", () => {
    expect(row[column("Units")]).toEqual({ value: 12, type: Number });
    expect(row[column("Year built")]).toEqual({ value: 1998, type: Number });
    expect(row[column("Quantity")]).toEqual({ value: 1, type: Number });
    expect(row[column("Useful life")]).toEqual({ value: 25, type: Number });
    expect(row[column("Cost each")]).toEqual({ value: 38000, type: Number, format: "#,##0" });
    expect(listSheet(oneRow({ "Cost each": "0.15" })).data[1][column("Cost each")]).toEqual({ value: 0.15, type: Number });
  });

  it("keeps text as text: a guessed year, a building called 123, and a note that looks like a formula", () => {
    expect(row[column("Install year")]).toEqual({ value: "approx 2005", type: String });
    expect(row[column("Building")]).toEqual({ value: "123", type: String });
    expect((row[column("Notes")] as CellObject).value).toBe(
      "=SUM(A1) is a note\nA second, much longer line of the note that runs past forty characters",
    );
    expect((row[column("Notes")] as CellObject).type).toBe(String);
  });

  it("leaves empty cells empty", () => {
    expect(row[column("Condition")]).toBeNull();
    expect(row[column("CapexClock ID")]).toBeNull();
  });

  it("makes each column wide enough for its heading and cells, within limits", () => {
    expect(sheet.columns).toHaveLength(FORMAT_COLUMNS.length);
    expect(sheet.columns[column("Install year is a guess")].width).toBe("Install year is a guess".length + 2);
    expect(sheet.columns[column("Units")].width).toBe(8);
    // "38,000" is shorter than "Cost each", so the heading sets it.
    expect(sheet.columns[column("Cost each")].width).toBe("Cost each".length + 2);
    expect(sheet.columns[column("Notes")].width).toBe(40);
  });
});

describe("the Excel files", () => {
  /** zlib in place of the browser's DecompressionStream. */
  const inflate = async (bytes: Uint8Array<ArrayBuffer>) => new Uint8Array(inflateRawSync(bytes));

  async function readBack(list: ListGrid) {
    const blob = await listXlsx(list, writeXlsxFile);
    const data = await blob.arrayBuffer();
    expect(new Uint8Array(data.slice(0, 4))).toEqual(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
    const tabs = await readWorkbook(data, readExcelFile, inflate);
    if (typeof tabs === "string") throw new Error(tabs);
    return tabs;
  }

  it("open as one visible tab, Sheet1, with the same cells as the CSV, numbers read as numbers", async () => {
    const list = componentListGrid({ name: "Maple Court", unitCount: "12", yearBuilt: "1998" }, [
      {
        id: "1b4e28ba-2fa1-11d2-883f-0016d3cca427",
        librarySlug: "tank-water-heater",
        category: "Plumbing",
        name: "Tank water heater",
        quantity: "12",
        unitLabel: "per_unit",
        followsUnitCount: false,
        installYear: "2016",
        usefulLife: "10",
        costEach: "$1,400",
        scenario: "run_to_failure",
        condition: "good",
        notes: "40 gallon, gas",
      },
    ]);
    const tabs = await readBack(list);
    expect(tabs).toEqual([{ name: LIST_SHEET_NAME, grid: expect.any(Array) }]);
    const [read] = tabs;
    expect(read.grid.map((r) => r.map(cellText))).toEqual(list.map((r) => r.map(cellText)));
    expect(read.grid[1][column("Units")]).toBe(12);
    expect(read.grid[1][column("Cost each")]).toBe(1400);
    expect(read.grid[1][column("CapexClock ID")]).toBe("1b4e28ba-2fa1-11d2-883f-0016d3cca427");
  });

  it("hold the blank template's headings and nothing else", async () => {
    const [tab] = await readBack(templateGrid());
    expect(tab.grid).toEqual([FORMAT_HEADINGS]);
  });

  it("hold the whole example", async () => {
    const [tab] = await readBack(exampleGrid());
    expect(tab.grid.map((r) => r.map(cellText))).toEqual(
      exampleGrid().map((r) => {
        const cells = r.map(cellText);
        while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
        return cells;
      }),
    );
  });
});
