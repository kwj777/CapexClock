import type { Grid } from "./text";

/** Most rows under the headings that one import reads. */
export const MAX_ROWS = 2000;
/** Largest file or paste, in bytes. */
export const MAX_BYTES = 5 * 1024 * 1024;
/** Widest sheet; a wider one is almost certainly not a component list. */
export const MAX_COLUMNS = 100;

/** Why an import stopped, as the import_failed event names it. */
export type FailReason = "too_big" | "no_header" | "unsupported" | "unreadable";

export type ImportSource = "paste" | "file";

export const FAIL_TEXT: Record<FailReason, string> = {
  too_big: "That's more than we can read at once. Import up to 2,000 rows and 5 MB at a time, or split the sheet.",
  no_header:
    "We couldn't find the headings. Copy the heading row too (like Item, Qty, Year installed, Cost) and try again.",
  unsupported:
    "We can't read that kind of file yet. In Excel or Numbers, save it as CSV (File > Save As, or Export), or copy the rows and paste them here.",
  unreadable: "We couldn't read that file. Make sure it's a CSV file, or copy the rows and paste them here.",
};

/** What a chosen file is, by its name and type: text we can read, a spreadsheet file, or neither. */
export function fileKind(name: string, type: string): "text" | "spreadsheet" | "other" {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  if (["csv", "tsv", "txt", "tab"].includes(ext)) return "text";
  if (["xlsx", "xlsm", "xls", "xlsb", "ods", "numbers"].includes(ext)) return "spreadsheet";
  if (/^text\/(csv|plain|tab-separated-values)$/.test(type) || type === "application/csv") return "text";
  return "other";
}

/** Bytes the text takes as UTF-8, to hold pasted text to the same limit as files. */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Splits CSV or tab-separated text into rows of cells: papaparse, passed in once it has loaded. */
export type CsvParse = (text: string, delimiter: string) => { data: unknown[]; errors: unknown[] };

/**
 * Text from a file or the clipboard as rows of cells. Rows from Excel and Google
 * Sheets are split on tabs; files use whatever separator they have. Every row is
 * kept, blank ones too, so row numbers match the sheet.
 */
export function readText(text: string, parse: CsvParse, source: ImportSource): Grid | FailReason {
  if (byteLength(text) > MAX_BYTES) return "too_big";
  const clean = text.replace(/^﻿/, "");
  // A spreadsheet or other binary file given a .csv name.
  if (/^PK\u0003\u0004/.test(clean) || clean.includes("\u0000") || (clean.match(/�/g)?.length ?? 0) > 20) {
    return "unreadable";
  }
  const delimiter = source === "paste" && clean.includes("\t") ? "\t" : "";
  const { data } = parse(clean.replace(/\r?\n$/, ""), delimiter);
  const grid: Grid = data.filter((row): row is unknown[] => Array.isArray(row));
  if (grid.some((row) => row.length > MAX_COLUMNS)) return "too_big";
  return grid;
}
