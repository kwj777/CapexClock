import { MAX_COLUMNS, type Problem } from "./read";
import { cellText, type Cell, type Grid } from "./text";

/** One tab of a workbook, or the whole of a pasted or CSV sheet. */
export interface Tab {
  name: string;
  grid: Grid;
}

/** read-excel-file's reader, passed in once it has loaded: every tab of an .xlsx file. */
export type XlsxRead = (data: ArrayBuffer) => Promise<unknown>;

/** Most tabs one workbook can have for us to list. */
export const MAX_TABS = 50;

/** What a file's first bytes say it is: a zip (.xlsx, .ods, .numbers), an old Office file (.xls, or a locked .xlsx), or neither. */
export function sniff(bytes: Uint8Array): "zip" | "office" | "other" {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "zip";
  const office = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (office.every((b, i) => bytes[i] === b)) return "office";
  return "other";
}

/** A row without the empty cells at its end. */
function trimRow(row: readonly Cell[]): Cell[] {
  let end = row.length;
  while (end > 0 && cellText(row[end - 1]) === "") end--;
  return row.slice(0, end);
}

/**
 * The tabs read-excel-file found, checked, since its result is typed loosely: a
 * name and rows of cells for each, with empty cells and rows trimmed from the
 * ends. Cells stay unknown until the importer reads them.
 */
export function tabsFromWorkbook(raw: unknown): Tab[] | Problem {
  if (!Array.isArray(raw)) return "unreadable";
  const tabs: Tab[] = [];
  for (const [i, item] of raw.slice(0, MAX_TABS).entries()) {
    if (typeof item !== "object" || item === null) return "unreadable";
    const { sheet, data } = item as { sheet?: unknown; data?: unknown };
    if (!Array.isArray(data)) return "unreadable";
    const grid: Grid = data.map((row: unknown) => (Array.isArray(row) ? trimRow(row) : []));
    while (grid.length > 0 && grid[grid.length - 1].length === 0) grid.pop();
    const name = typeof sheet === "string" && sheet.trim() !== "" ? sheet.trim() : `Sheet${i + 1}`;
    tabs.push({ name, grid });
  }
  if (tabs.length === 0 || tabs.every((t) => t.grid.length === 0)) return "empty_file";
  return tabs;
}

/** Why read-excel-file couldn't read a file: an old .xls file (or a locked one), or a damaged one. */
export function xlsxProblem(error: unknown): Problem {
  const { name, code } = (typeof error === "object" && error !== null ? error : {}) as { name?: unknown; code?: unknown };
  if (name === "InvalidInputError" && code === "XLS_FILE_NOT_SUPPORTED") return "unsupported";
  if (name === "InvalidInputError" && code === "NO_DATA") return "empty_file";
  return "unreadable";
}

/** A tab too wide to be a component list. */
export function tooWide(tab: Tab): boolean {
  return tab.grid.some((row) => row.length > MAX_COLUMNS);
}

/** Every tab of an .xlsx file, or why it can't be read. The file never leaves the browser. */
export async function readWorkbook(data: ArrayBuffer, read: XlsxRead): Promise<Tab[] | Problem> {
  const kind = sniff(new Uint8Array(data.slice(0, 8)));
  // Old .xls files, and .xlsx files locked with a password, are Office's older kind of file.
  if (kind === "office") return "unsupported";
  if (kind !== "zip") return data.byteLength === 0 ? "empty_file" : "unreadable";
  try {
    return tabsFromWorkbook(await read(data));
  } catch (error) {
    return xlsxProblem(error);
  }
}
