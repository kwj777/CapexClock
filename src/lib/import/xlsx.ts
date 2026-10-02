import { MAX_COLUMNS, type Problem } from "./read";
import { cellText, type Cell, type Grid } from "./text";

/** One tab of a workbook, or the whole of a pasted or CSV sheet. */
export interface Tab {
  name: string;
  grid: Grid;
  /** Hidden in Excel, like a lookup or working sheet, so it isn't chosen for the owner. */
  hidden?: boolean;
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

/** A sheet as the workbook lists it: its name, and whether Excel hides it. */
export interface SheetState {
  name: string;
  hidden: boolean;
}

/**
 * The tabs read-excel-file found, checked, since its result is typed loosely: a
 * name and rows of cells for each, with empty cells and rows trimmed from the
 * ends. Cells stay unknown until the importer reads them. `states` marks the
 * hidden ones; it's used only when it lists the same sheets in the same order.
 */
export function tabsFromWorkbook(raw: unknown, states: readonly SheetState[] | null = null): Tab[] | Problem {
  if (!Array.isArray(raw)) return "unreadable";
  const sheets: { sheet: unknown; data: unknown }[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return "unreadable";
    const { sheet, data } = item as { sheet?: unknown; data?: unknown };
    sheets.push({ sheet, data });
  }
  const sameSheets = states !== null && states.length === sheets.length && sheets.every((s, i) => s.sheet === states[i].name);
  const tabs: Tab[] = [];
  for (const [i, { sheet, data }] of sheets.slice(0, MAX_TABS).entries()) {
    if (!Array.isArray(data)) return "unreadable";
    const grid: Grid = data.map((row: unknown) => (Array.isArray(row) ? trimRow(row) : []));
    while (grid.length > 0 && grid[grid.length - 1].length === 0) grid.pop();
    const name = typeof sheet === "string" && sheet.trim() !== "" ? sheet.trim() : `Sheet${i + 1}`;
    tabs.push(sameSheets && states[i].hidden ? { name, grid, hidden: true } : { name, grid });
  }
  if (tabs.length === 0 || tabs.every((t) => t.grid.length === 0)) return "empty_file";
  return tabs;
}

/** Unpacks deflated bytes: the browser's DecompressionStream, or zlib in tests. */
export type Inflate = (bytes: Uint8Array<ArrayBuffer>) => Promise<Uint8Array>;

/**
 * One file inside a zip (an .xlsx file is one), by its path, or null when it
 * isn't there or is stored in a way this doesn't read. Only the zip's own index
 * and that one file are looked at.
 */
export async function zipEntry(data: ArrayBuffer, path: string, inflate: Inflate): Promise<Uint8Array | null> {
  const bytes = new Uint8Array(data);
  const view = new DataView(data);
  // The end record is the last 22 bytes, before a comment of up to 65,535 bytes.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) return null;
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    if (name !== path) continue;
    if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) return null;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + size > bytes.length) return null;
    const stored = bytes.slice(start, start + size);
    if (method === 0) return stored;
    return method === 8 ? inflate(stored) : null;
  }
  return null;
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function xmlText(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, code: string) => {
    if (code[0] !== "#") return XML_ENTITIES[code.toLowerCase()] ?? whole;
    const point = code[1].toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
    return point <= 0x10ffff ? String.fromCodePoint(point) : whole;
  });
}

function xmlAttribute(attributes: string, name: string): string | null {
  const found = attributes.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`));
  return found ? xmlText(found[1] ?? found[2] ?? "") : null;
}

/** The sheets xl/workbook.xml lists, in order, with the ones Excel hides marked. */
export function parseSheetStates(xml: string): SheetState[] {
  const states: SheetState[] = [];
  for (const [, attributes] of xml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?sheet\s([^>]*)>/g)) {
    const name = xmlAttribute(attributes, "name");
    if (name === null) continue;
    const state = xmlAttribute(attributes, "state");
    states.push({ name, hidden: state === "hidden" || state === "veryHidden" });
  }
  return states;
}

/** Which of a workbook's sheets are hidden, or null when that can't be read (the tabs are still read). */
export async function sheetStates(data: ArrayBuffer, inflate: Inflate): Promise<SheetState[] | null> {
  try {
    const xml = await zipEntry(data, "xl/workbook.xml", inflate);
    return xml ? parseSheetStates(new TextDecoder().decode(xml)) : null;
  } catch {
    return null;
  }
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

/**
 * Every tab of an .xlsx file, or why it can't be read, with hidden ones marked
 * when `inflate` is given. The file never leaves the browser.
 */
export async function readWorkbook(data: ArrayBuffer, read: XlsxRead, inflate?: Inflate): Promise<Tab[] | Problem> {
  const kind = sniff(new Uint8Array(data.slice(0, 8)));
  // Old .xls files, and .xlsx files locked with a password, are Office's older kind of file.
  if (kind === "office") return "unsupported";
  if (kind !== "zip") return data.byteLength === 0 ? "empty_file" : "unreadable";
  let raw: unknown;
  try {
    raw = await read(data);
  } catch (error) {
    return xlsxProblem(error);
  }
  return tabsFromWorkbook(raw, inflate ? await sheetStates(data, inflate) : null);
}
