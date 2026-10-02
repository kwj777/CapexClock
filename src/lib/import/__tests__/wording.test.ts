import { preview } from "../__fixtures__/sheets";
import type { ImportedRow, Preview, PreviewRow } from "../preview";
import {
  addLabel,
  columnLetter,
  detailsText,
  duplicates,
  duplicateText,
  previewHints,
  previewSummary,
  rowNumbers,
  skippedLines,
} from "../wording";

const row = (overrides: Partial<ImportedRow> = {}): ImportedRow => ({
  librarySlug: "tank-water-heater",
  category: "Plumbing",
  name: "Tank water heater",
  quantity: "12",
  unitLabel: "per_unit",
  installYear: "2014",
  installYearIsGuess: false,
  usefulLife: "10",
  costEach: "1400",
  condition: null,
  notes: "",
  ...overrides,
});

const previewRow = (id: string, overrides: Partial<ImportedRow> = {}): PreviewRow => ({
  id,
  keys: [id],
  sheetRows: [2],
  status: "ready",
  row: row(overrides),
  changes: [],
  issues: [],
  question: null,
  lifeIsTypical: false,
});

describe("import wording", () => {
  it("shortens runs of row numbers", () => {
    expect(rowNumbers([4])).toBe("Row 4");
    expect(rowNumbers([5, 4])).toBe("Rows 4 and 5");
    expect(rowNumbers([4, 5, 6, 9])).toBe("Rows 4–6 and 9");
    expect(rowNumbers(Array.from({ length: 30 }, (_, i) => i * 2))).toBe(
      "Rows 0, 2, 4, 6, 8, 10, 12, 14, 16, 18 and 20 more",
    );
  });

  it("groups skipped rows by why", () => {
    expect(
      skippedLines([
        { sheetRow: 1, reason: "above_headings" },
        { sheetRow: 2, reason: "above_headings" },
        { sheetRow: 9, reason: "blank" },
        { sheetRow: 30, reason: "total" },
        { sheetRow: 14, reason: "blank" },
      ]),
    ).toEqual(["Rows 1 and 2: above the headings", "Rows 9 and 14: blank", "Row 30: a total row"]);
  });

  it("sums up the preview for the live region", () => {
    expect(previewSummary({ rows: 23, ready: 15, changed: 5, needsYou: 3, skipped: 2 })).toBe(
      "23 rows to add: 15 ready, 5 changed, 3 need you. 2 rows skipped.",
    );
    expect(previewSummary({ rows: 1, ready: 0, changed: 0, needsYou: 1, skipped: 1 })).toBe(
      "1 row to add: 1 needs you. 1 row skipped.",
    );
    expect(previewSummary({ rows: 0, ready: 0, changed: 0, needsYou: 0, skipped: 4 })).toBe("No rows to add. 4 rows skipped.");
    expect(previewSummary({ rows: 2000, ready: 2000, changed: 0, needsYou: 0, skipped: 0 })).toBe("2,000 rows to add: 2,000 ready.");
  });

  it("labels the Add button with the count", () => {
    expect(addLabel(23)).toBe("Add 23 rows");
    expect(addLabel(1)).toBe("Add 1 row");
  });

  it("finds items already in the list, by library item or by name", () => {
    const draftRows = [
      { librarySlug: "tank-water-heater", name: "Tank water heater" },
      { librarySlug: null, name: "Elevator" },
    ];
    const rows = [
      previewRow("a"),
      previewRow("b", { librarySlug: null, name: "elevator" }),
      previewRow("c", { librarySlug: "refrigerator", name: "Refrigerator" }),
    ];
    const found = duplicates(draftRows, rows);
    expect([...found.ids]).toEqual(["a", "b"]);
    expect(found.names).toEqual(["Tank water heater", "elevator"]);
  });

  it("warns about duplicates in plain words", () => {
    expect(duplicateText([])).toBe("");
    expect(duplicateText(["Boiler"])).toBe(
      "Your list already has Boiler. Adding puts in another row for it, so remove any you don't need.",
    );
    expect(duplicateText(["A", "B", "C", "D", "E", "F", "G"])).toBe(
      "Your list already has A, B, C, D, E and 2 more items. Adding puts in another row for each, so remove any you don't need.",
    );
  });

  it("shows what each row will hold", () => {
    expect(detailsText(row(), false)).toBe("Qty 12 · Installed 2014 · Life 10 yrs · $1,400 each");
    expect(detailsText(row({ installYearIsGuess: true, condition: "fair" }), true)).toBe(
      "Qty 12 · Installed 2014 (guess) · Life 10 yrs (typical) · $1,400 each · Fair condition",
    );
    expect(detailsText(row({ unitLabel: "per_sq_ft", quantity: "9600", costEach: "0.25" }), false)).toBe(
      "9,600 sq ft · Installed 2014 · Life 10 yrs · $0.25 per sq ft",
    );
    expect(detailsText(row({ installYear: "", usefulLife: "", costEach: "" }), false)).toBe(
      "Qty 12 · Installed: year built (estimate) · No useful life yet · No cost yet",
    );
    expect(detailsText(row({ installYear: "Jun-14", quantity: "a few", costEach: "call Bob" }), false)).toBe(
      'Qty "a few" · Installed "Jun-14" · Life 10 yrs · Cost "call Bob"',
    );
  });

  it("says what's left to do", () => {
    const base: Preview = {
      rows: [],
      skipped: [],
      questions: [],
      usesSheetYear: false,
      missingItemColumn: false,
      noQuantityColumn: false,
      quantityFromTotals: false,
      doubtfulQuantity: null,
      noYearColumn: false,
      doubtfulYears: [],
      withoutCost: 0,
      counts: { rows: 0, ready: 0, changed: 0, needsYou: 0, skipped: 0 },
    };
    expect(previewHints(base)).toEqual([]);
    expect(previewHints({ ...base, missingItemColumn: true, noQuantityColumn: true })).toEqual([
      "Choose which column has the item names.",
    ]);
    expect(previewHints({ ...base, noQuantityColumn: true, withoutCost: 1 })).toEqual([
      "There's no quantity column, so each row counts as one, and identical rows are added up.",
      "1 row has no cost yet. Add costs after importing to include it in the forecast.",
    ]);
    expect(previewHints({ ...base, noQuantityColumn: true, quantityFromTotals: true })).toEqual([
      "There's no quantity column, so we worked out quantities from the totals where they divide evenly. Other rows count as one, and identical rows are added up.",
    ]);
    expect(previewHints({ ...base, withoutCost: 8 })).toEqual([
      "8 rows have no cost yet. Add costs after importing to include them in the forecast.",
    ]);
    expect(previewHints({ ...base, noYearColumn: true })).toEqual([
      "No column has install years, so each item uses the year built, marked an estimate. If one does, choose Install year for it above.",
    ]);
    expect(previewHints({ ...base, doubtfulQuantity: { column: 0, heading: "#" } })).toEqual([
      'We used column A, "#", as the quantity. If it numbers the rows or apartments instead, set it to Ignore.',
    ]);
  });

  it("names year columns that could mean something else", () => {
    const base = preview("Item,Qty,Date,Cost\nFridge,12,2018,900");
    expect(previewHints({ ...base, withoutCost: 0 })).toEqual([
      'We read column C, "Date", as when each item was installed or last replaced. If it\'s another date, like a service date or the year to replace by, change it above.',
    ]);
    const due = preview("Item,Qty,Replacement year,Cost\nFridge,12,2030,900");
    expect(previewHints(due)).toEqual([
      'We read column C, "Replacement year", as the year to replace each item by. If it\'s when each item was last replaced, choose Install year for it above.',
    ]);
    expect(previewHints(preview("Item,Qty,Year installed,Cost\nFridge,12,2018,900"))).toEqual([]);
  });

  it("names columns the way spreadsheets do", () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnLetter)).toEqual(["A", "B", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
  });
});
