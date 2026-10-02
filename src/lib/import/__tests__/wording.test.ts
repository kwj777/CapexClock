import { preview } from "../__fixtures__/sheets";
import type { ImportedRow, Preview, PreviewRow } from "../preview";
import {
  addLabel,
  columnLetter,
  detailsText,
  duplicates,
  duplicateText,
  longListText,
  previewHints,
  previewSummary,
  quantityAnswers,
  rowLabel,
  quantityQuestionText,
  rowNumbers,
  skippedLines,
  SLOW_ROWS,
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
  replaceNow: false,
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
  building: "",
  capexclockId: null,
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
    expect(previewSummary({ rows: 23, ready: 15, changed: 5, needsYou: 3, skipped: 2, otherBuildings: 0 })).toBe(
      "23 rows to add: 15 ready, 5 changed, 3 need you. 2 rows skipped.",
    );
    expect(previewSummary({ rows: 1, ready: 0, changed: 0, needsYou: 1, skipped: 1, otherBuildings: 0 })).toBe(
      "1 row to add: 1 needs you. 1 row skipped.",
    );
    expect(previewSummary({ rows: 0, ready: 0, changed: 0, needsYou: 0, skipped: 4, otherBuildings: 0 })).toBe("No rows to add. 4 rows skipped.");
    expect(previewSummary({ rows: 2000, ready: 2000, changed: 0, needsYou: 0, skipped: 0, otherBuildings: 0 })).toBe("2,000 rows to add: 2,000 ready.");
  });

  it("says rows of other buildings aren't shown, without calling them skipped", () => {
    expect(previewSummary({ rows: 75, ready: 0, changed: 0, needsYou: 75, skipped: 0, otherBuildings: 19 })).toBe(
      "75 rows to add: 75 need you. Rows for 19 other buildings aren't shown.",
    );
    expect(previewSummary({ rows: 3, ready: 3, changed: 0, needsYou: 0, skipped: 1, otherBuildings: 1 })).toBe(
      "3 rows to add: 3 ready. 1 row skipped. Rows for another building aren't shown.",
    );
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
      areaColumn: false,
      quantityQuestion: null,
      noYearColumn: false,
      doubtfulYears: [],
      sameItems: [],
      withoutCost: 0,
      buildings: [],
      idColumn: false,
      counts: { rows: 0, ready: 0, changed: 0, needsYou: 0, skipped: 0, otherBuildings: 0 },
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
    expect(previewHints({ ...base, noQuantityColumn: true, areaColumn: true })).toEqual([
      "There's no quantity column, so each row counts as one, and identical rows are added up. Items priced per sq ft use the Square feet column instead.",
    ]);
    expect(previewHints({ ...base, withoutCost: 8 })).toEqual([
      "8 rows have no cost yet. Add costs after importing to include them in the forecast.",
    ]);
    expect(previewHints({ ...base, sameItems: [{ column: 2, heading: "Water heater age", kept: 1, name: "Tank water heater" }] })).toEqual([
      'We left out column C, "Water heater age", since column B already gives each apartment\'s Tank water heater. If they\'re separate items, choose Tank water heater for column C above.',
    ]);
    expect(previewHints({ ...base, noYearColumn: true })).toEqual([
      "No column has install years, so each item uses the year built, marked an estimate. If one does, choose Install year for it above.",
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

  it("asks what a Units column with one number is, and holds the no-quantity hint until it's answered", () => {
    const sheet = "Item,Units,Year installed,Cost\nWater heater,12,2016,1400\nFridge,12,2018,900";
    const asked = preview(sheet);
    if (!asked.quantityQuestion) throw new Error("No quantity question");
    expect(asked.quantityQuestion).toEqual({ column: 1, heading: "Units", kind: "same", values: ["12"], answer: null });
    expect(quantityQuestionText(asked.quantityQuestion)).toBe('Column B, "Units", says 12 on every row. What is it?');
    expect(quantityAnswers(asked.quantityQuestion)).toEqual([
      ["quantity", "How many of each item there are"],
      ["each_one", "The number of units in the building, so each row counts as one"],
    ]);
    expect(previewHints(asked)).toEqual([]);
    expect(previewHints(preview(sheet, { quantityAnswered: true }))).toEqual([
      "There's no quantity column, so each row counts as one, and identical rows are added up.",
    ]);
    // Answered as the quantity: no hint about the quantity at all.
    expect(previewHints(preview(sheet, { columns: ["item", "quantity", "installYear", "cost"], quantityAnswered: true }))).toEqual([]);
  });

  it("asks what a # column's numbers are, naming a few of them", () => {
    const asked = preview("#,Item,Year\n4,Fridge,2018\n101,Range,2018\n4,Stove,2015\n7,Dishwasher,2019");
    if (!asked.quantityQuestion) throw new Error("No quantity question");
    expect(quantityQuestionText(asked.quantityQuestion)).toBe('Column A, "#", has numbers like 4, 101 and 7. What are they?');
    expect(quantityAnswers(asked.quantityQuestion)[1]).toEqual(["each_one", "Row or apartment numbers, so each row counts as one"]);
    expect(quantityQuestionText({ column: 0, heading: "No.", kind: "numbers", values: ["5"] })).toBe(
      'Column A, "No.", has the number 5. What is it?',
    );
    expect(quantityQuestionText({ column: 1, heading: "# of units", kind: "same", values: ["1,200"] })).toBe(
      'Column B, "# of units", says 1,200 on every row. What is it?',
    );
  });

  it("warns before a list gets long enough to slow the calculator", () => {
    expect(longListText(0, SLOW_ROWS)).toBe("");
    expect(longListText(450, 50)).toBe("");
    expect(longListText(0, 0)).toBe("");
    expect(longListText(900, 0)).toBe("");
    expect(longListText(0, 2000)).toBe(
      "That's 2,000 rows, and the calculator gets slow past about 500. Typing may lag. To keep it quick, put each item on one row with a quantity, or import part of the sheet at a time.",
    );
    expect(longListText(490, 20)).toBe(
      "Adding these makes 510 rows in your list, and the calculator gets slow past about 500. Typing may lag. To keep it quick, put each item on one row with a quantity, or import part of the sheet at a time.",
    );
  });

  it("names a row for the fix boxes beside it", () => {
    const p = preview(["Item,Qty,Year installed", "Gas furnace,12,Jun-14", "Water heater,1,1850", "Water heater,1,1850", ",3,2014"].join("\n"));
    expect(p.rows.filter((r) => r.status === "needs_you").map(rowLabel)).toEqual(["Gas furnace, row 2", "Tank water heater, rows 3 and 4", "row 5"]);
  });

  it("names columns the way spreadsheets do", () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnLetter)).toEqual(["A", "B", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
  });
});
