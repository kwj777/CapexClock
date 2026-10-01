import { openSheet, parseSheetYear, startingChoices } from "../open";
import { byteLength, fileKind, MAX_BYTES, readText } from "../read";
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

  it("stops at 5 MB and 100 columns", () => {
    expect(readText("x".repeat(MAX_BYTES + 1), parse, "paste")).toBe("too_big");
    expect(readText(Array(101).fill("a").join(","), parse, "file")).toBe("too_big");
    expect(byteLength("é")).toBe(2);
  });

  it("knows which files it can read", () => {
    expect(fileKind("components.csv", "")).toBe("text");
    expect(fileKind("export.TSV", "")).toBe("text");
    expect(fileKind("noext", "text/csv")).toBe("text");
    expect(fileKind("Capex.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("spreadsheet");
    expect(fileKind("old.xls", "")).toBe("spreadsheet");
    expect(fileKind("plan.numbers", "")).toBe("spreadsheet");
    expect(fileKind("photo.jpg", "image/jpeg")).toBe("other");
  });
});

describe("opening a sheet", () => {
  it("says when there are no headings", () => {
    expect(openSheet([["Water heater", "12", "2016"]], match)).toBe("no_header");
  });

  it("stops at 2,000 rows under the headings", () => {
    const rows = (n: number) => [["Item", "Qty"], ...Array.from({ length: n }, () => ["Fridge", "1"])];
    expect(openSheet(rows(2001), match)).toBe("too_big");
    expect(typeof openSheet(rows(2000), match)).toBe("object");
    // Blank rows at the end don't count.
    expect(typeof openSheet([...rows(2000), [""], [""]], match)).toBe("object");
  });

  it("starts with the guesses and this year as the sheet's year", () => {
    const opened = openSheet([["Item", "Age"], ["Fridge", "8"]], match);
    if (typeof opened === "string") throw new Error(opened);
    expect(startingChoices(opened, 2026)).toEqual({
      layout: "rows",
      columns: ["item", "age"],
      sheetYear: 2026,
      answers: {},
      fixes: {},
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
