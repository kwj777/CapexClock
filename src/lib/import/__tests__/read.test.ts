import { openSheet, parseSheetYear, startingChoices } from "../open";
import { byteLength, decodeText, failedReason, fileKind, MAX_BYTES, PROBLEM_TEXT, readText } from "../read";
import { match, parse } from "../__fixtures__/sheets";

describe("reading pasted rows and CSV files", () => {
  it("splits rows copied from Excel or Google Sheets on tabs, so $1,400 stays one cell", () => {
    const grid = readText("Item\tCost\nWater heater\t$1,400\n", parse, "paste");
    expect(grid).toEqual([
      ["Item", "Cost"],
      ["Water heater", "$1,400"],
    ]);
  });

  it("reads quoted commas and line breaks in CSV files", () => {
    const grid = readText('Item,Cost,Notes\r\nRoof,"$38,000","Patched\nin 2019"\r\n', parse, "file");
    expect(grid).toEqual([
      ["Item", "Cost", "Notes"],
      ["Roof", "$38,000", "Patched\nin 2019"],
    ]);
  });

  it("finds semicolon-separated files too", () => {
    expect(readText("Item;Qty\nFridge;12", parse, "file")).toEqual([
      ["Item", "Qty"],
      ["Fridge", "12"],
    ]);
  });

  it("drops the byte-order mark Excel puts at the start of CSV files", () => {
    expect(readText("﻿Item,Qty\nFridge,12", parse, "file")).toEqual([
      ["Item", "Qty"],
      ["Fridge", "12"],
    ]);
  });

  it("keeps blank rows, so row numbers match the sheet", () => {
    expect(readText("Title\n\nItem,Qty", parse, "file")).toEqual([["Title"], [""], ["Item", "Qty"]]);
  });

  it("won't read a spreadsheet or binary file given a .csv name", () => {
    expect(readText("PK\u0003\u0004\u0014\u0000\u0006", parse, "file")).toBe("unreadable");
    expect(readText("abc\u0000def", parse, "file")).toBe("unreadable");
  });

  it("reads files saved as UTF-8, Windows CSV or Unicode text", () => {
    const utf8 = new TextEncoder().encode("Item,Cost\nCaf\u00e9 fridge,$1,200\u2013$1,500");
    expect(decodeText(utf8)).toBe("Item,Cost\nCaf\u00e9 fridge,$1,200\u2013$1,500");
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]))).toBe("Item,Cost\nCaf\u00e9 fridge,$1,200\u2013$1,500");
    // Excel on Windows: "CSV (Comma delimited)" is Windows-1252, where é is E9, the en dash 96 and ½ BD.
    const windows = new Uint8Array([...new TextEncoder().encode("Owner's 1"), 0xbd, 0x2c, 0x43, 0x61, 0x66, 0xe9, 0x2c, 0x31, 0x96, 0x32, 0x92]);
    expect(decodeText(windows)).toBe("Owner's 1\u00bd,Caf\u00e9,1\u20132\u2019");
    // Excel's "Unicode Text" is UTF-16 with a byte order mark.
    const utf16 = new Uint8Array([0xff, 0xfe, 0x49, 0x00, 0x74, 0x00, 0x09, 0x00, 0xe9, 0x00]);
    expect(decodeText(utf16)).toBe("It\t\u00e9");
    expect(decodeText(new Uint8Array([0xfe, 0xff, 0x00, 0x49, 0x00, 0x74]))).toBe("It");
  });

  it("stops at 5 MB and 100 columns", () => {
    expect(readText("x".repeat(MAX_BYTES + 1), parse, "paste")).toBe("too_big");
    expect(readText(Array(101).fill("a").join(","), parse, "file")).toBe("too_big");
    expect(byteLength("é")).toBe(2);
  });

  it("knows which files it can read", () => {
    expect(fileKind("components.csv", "")).toBe("text");
    expect(fileKind("export.TSV", "")).toBe("text");
    expect(fileKind("noext", "text/csv")).toBe("text");
    expect(fileKind("Capex.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("xlsx");
    expect(fileKind("Capex.XLSM", "")).toBe("xlsx");
    expect(fileKind("download", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("xlsx");
    expect(fileKind("old.xls", "")).toBe("spreadsheet");
    expect(fileKind("plan.numbers", "")).toBe("spreadsheet");
    expect(fileKind("libre.ods", "")).toBe("spreadsheet");
    // Windows calls CSV files "application/vnd.ms-excel"; the name says what they are.
    expect(fileKind("list.csv", "application/vnd.ms-excel")).toBe("text");
    expect(fileKind("photo.jpg", "image/jpeg")).toBe("other");
  });
});

describe("opening a sheet", () => {
  it("says when there are no headings", () => {
    expect(openSheet([["Water heater", "12", "2016"]], match, 2026)).toBe("no_header");
  });

  it("says which file to use when given the forecast download, which can't be read back", () => {
    const grid = [
      ["Year", "Component", "Category", "Quantity", "Unit", "Cost each", "Total cost", "Forecast note", "Condition", "Notes"],
      ["2027", "Tank water heater", "Plumbing", "12", "per apartment", "1400.00", "16800.00", "", "", ""],
    ];
    expect(openSheet(grid, match, 2026)).toBe("forecast_file");
    expect(failedReason("forecast_file")).toBe("forecast_file");
    expect(PROBLEM_TEXT.forecast_file).toMatch(/Download component list \(Excel\)/);
  });

  it("says the same for a forecast downloaded from the live site before condition and notes were added", () => {
    // A forecast CSV as capexclock.com wrote it before Phase 3: the last column was "Note".
    const text = [
      "Year,Component,Category,Quantity,Unit,Cost each,Total cost,Note",
      "2026,Tank water heater,Plumbing,12,each,1400.00,16800.00,Past its expected life; Install year estimated",
      "2027,Asphalt shingle roof,Roofing,1,each,38000.00,38000.00,",
      ",Boiler,HVAC,,,,,Not included yet: details missing",
      "",
    ].join("\r\n");
    const grid = readText(text, parse, "file");
    if (typeof grid === "string") throw new Error(grid);
    expect(openSheet(grid, match, 2026)).toBe("forecast_file");
  });

  it("stops at 2,000 rows under the headings", () => {
    const rows = (n: number) => [["Item", "Qty"], ...Array.from({ length: n }, () => ["Fridge", "1"])];
    expect(openSheet(rows(2001), match, 2026)).toBe("too_big");
    expect(typeof openSheet(rows(2000), match, 2026)).toBe("object");
    // Blank rows at the end don't count.
    expect(typeof openSheet([...rows(2000), [""], [""]], match, 2026)).toBe("object");
  });

  it("starts with the guesses and this year as the sheet's year", () => {
    const opened = openSheet([["Item", "Age"], ["Fridge", "8"]], match, 2026);
    if (typeof opened === "string") throw new Error(opened);
    expect(startingChoices(opened, 2026)).toEqual({
      layout: "rows",
      columns: ["item", "age"],
      sheetYear: 2026,
      answers: {},
      fixes: {},
      quantityAnswered: false,
    });
  });

  it("checks the year the sheet was last updated", () => {
    expect(parseSheetYear("2024", 2026)).toBe(2024);
    expect(parseSheetYear(" 2026 ", 2026)).toBe(2026);
    expect(parseSheetYear("2027", 2026)).toBeNull();
    expect(parseSheetYear("24", 2026)).toBeNull();
    expect(parseSheetYear("", 2026)).toBeNull();
  });
});

describe("what the panel says when it can't read something", () => {
  it("sends import_failed for a chosen file with nothing in it, but not for an empty paste box", () => {
    expect(failedReason("empty_file")).toBe("no_header");
    expect(PROBLEM_TEXT.empty_file).toBe("That file is empty. Choose another file, or copy the rows and paste them here.");
    expect(failedReason("empty")).toBeNull();
    expect(failedReason("loading_failed")).toBeNull();
    expect(failedReason("too_big")).toBe("too_big");
    expect(failedReason("unreadable")).toBe("unreadable");
  });
});
