import type { Grid } from "./text";

/** Most rows under the headings that one import reads. */
export const MAX_ROWS = 2000;
/** Largest file or paste, in bytes. */
export const MAX_BYTES = 5 * 1024 * 1024;
/** Widest sheet; a wider one is almost certainly not a component list. */
export const MAX_COLUMNS = 100;

/**
 * Why an import stopped, as the import_failed event names it. "forecast_file" is
 * our forecast download, which lists replacements, not components.
 */
export type FailReason = "too_big" | "no_header" | "unsupported" | "unreadable" | "forecast_file";

/** Where the rows came from: pasted, a CSV or text file, or an Excel file. */
export type ImportSource = "paste" | "file" | "xlsx";

export const FAIL_TEXT: Record<FailReason, string> = {
  too_big: "That's more than we can read at once. Import up to 2,000 rows and 5 MB at a time, or split the sheet.",
  no_header:
    "We couldn't find the headings. Copy the heading row too (like Item, Qty, Year installed, Cost) and try again.",
  unsupported:
    "We can't read that kind of file. Save it as .xlsx or CSV (File > Save As in Excel, File > Export in Numbers, File > Download in Google Sheets), or copy the rows and paste them here. If the file has a password, take it off first.",
  unreadable: "We couldn't read that file. Make sure it's an .xlsx or CSV file, or copy the rows and paste them here.",
  forecast_file:
    "That's a forecast download, with a row for each replacement, so it can't be read back in. Use Download component list (CSV) instead, and import that file.",
};

/**
 * What the panel tells the owner: a failed import, or "empty" (nothing pasted yet),
 * "empty_file" (a chosen file with nothing in it) or "loading_failed" (the importer
 * itself didn't load).
 */
export type Problem = FailReason | "empty" | "empty_file" | "loading_failed";

export const PROBLEM_TEXT: Record<Problem, string> = {
  ...FAIL_TEXT,
  empty: "Paste some rows first, headings included.",
  empty_file: "That file is empty. Choose another file, or copy the rows and paste them here.",
  loading_failed: "The importer didn't load. Check your connection, then close this and try again.",
};

/**
 * The reason import_failed sends, or null when nothing was imported yet: an empty
 * paste box isn't an import, but a chosen file started one, and an empty file has no headings.
 */
export function failedReason(problem: Problem): FailReason | null {
  if (problem === "empty" || problem === "loading_failed") return null;
  return problem === "empty_file" ? "no_header" : problem;
}

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * What a chosen file is, by its name and type: text we can read, an Excel file we
 * can read, another spreadsheet file we can't (.xls, .ods, Numbers), or neither.
 */
export function fileKind(name: string, type: string): "text" | "xlsx" | "spreadsheet" | "other" {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  if (["csv", "tsv", "txt", "tab"].includes(ext)) return "text";
  if (["xlsx", "xlsm"].includes(ext)) return "xlsx";
  if (["xls", "xlsb", "ods", "numbers"].includes(ext)) return "spreadsheet";
  if (/^text\/(csv|plain|tab-separated-values)$/.test(type) || type === "application/csv") return "text";
  if (type === XLSX_TYPE) return "xlsx";
  return "other";
}

/**
 * A file's text. UTF-8 when it is (with or without a byte order mark), UTF-16 when
 * it starts with that mark (Excel's "Unicode Text"), and otherwise Windows-1252,
 * which Excel on Windows uses for "CSV (Comma delimited)".
 */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
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
