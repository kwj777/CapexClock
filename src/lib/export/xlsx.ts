import type { Cell, SheetData } from "write-excel-file/universal";
import type { FieldKind } from "@/lib/import/columns";
import { FORMAT_COLUMNS } from "@/lib/import/format";
import type { ListGrid } from "./component-list";

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * The importer names a property after its tab, unless the tab is called Sheet1:
 * then it uses the file's name, as it does for a CSV. So the Excel downloads
 * import exactly like the CSV ones.
 */
export const LIST_SHEET_NAME = "Sheet1";

/** Columns written as numbers, so Excel can sort them and add them up. */
const NUMBER_FIELDS: ReadonlySet<FieldKind> = new Set(["unitCount", "yearBuilt", "quantity", "installYear", "life", "cost"]);

/** Column widths, in characters. */
const MIN_WIDTH = 8;
const MAX_WIDTH = 40;

/**
 * The number a cell's text is, exactly, or null. "1998", "12" and "4.5" are;
 * "approx 1998", "1,400" and "1e3" aren't, and stay text as the owner typed them.
 */
export function exactNumber(text: string): number | null {
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return String(value) === text ? value : null;
}

function cell(text: string, field: FieldKind): Cell {
  if (text === "") return null;
  const value = NUMBER_FIELDS.has(field) ? exactNumber(text) : null;
  if (value === null) return { value: text, type: String };
  // Whole-dollar costs read 38,000. Others, like $0.15 a sq ft, show as they are.
  return field === "cost" && Number.isInteger(value) ? { value, type: Number, format: "#,##0" } : { value, type: Number };
}

/** The longest line in a cell, as Excel shows it, so a note with line breaks isn't counted as one line. */
function shownLength(text: string, field: FieldKind): number {
  const value = field === "cost" ? exactNumber(text) : null;
  const shown = value !== null && Number.isInteger(value) ? value.toLocaleString("en-US") : text;
  return Math.max(...shown.split(/\r\n?|\n/).map((line) => Array.from(line).length));
}

/** A list as one sheet: bold headings that stay in view, numbers as numbers, and columns wide enough to read. */
export function listSheet(list: ListGrid) {
  const [headings = [], ...rows] = list;
  const data: SheetData = [
    headings.map((heading): Cell => ({ value: heading, type: String, fontWeight: "bold" })),
    ...rows.map((row) => FORMAT_COLUMNS.map((c, i) => cell(row[i] ?? "", c.field))),
  ];
  const columns = FORMAT_COLUMNS.map((c, i) => {
    const longest = Math.max(...list.map((row) => shownLength(row[i] ?? "", c.field)));
    return { width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longest + 2)) };
  });
  return { data, columns, sheet: LIST_SHEET_NAME, stickyRowsCount: 1 };
}

export type ListSheet = ReturnType<typeof listSheet>;

/** Excel's own default font, named in the file as Excel itself does. */
const FONT = { fontFamily: "Calibri", fontSize: 11 };

/** write-excel-file's writer, passed in so the browser loads it only when someone downloads. */
export type XlsxWrite = (sheets: ListSheet[], options: typeof FONT) => { toBlob: () => Promise<Blob> };

/** A list as an Excel (.xlsx) file. */
export function listXlsx(list: ListGrid, write: XlsxWrite): Promise<Blob> {
  return write([listSheet(list)], FONT).toBlob();
}
