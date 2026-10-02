/**
 * Cells come from pasted text, a CSV file or (later) an Excel file, so they can be
 * strings, numbers, dates, booleans or empty. Nothing about them is trusted until
 * it's checked here.
 */
export type Cell = unknown;
export type Grid = Cell[][];

/** True for a real date (an Excel date cell), not an invalid one. */
export function isDate(cell: Cell): cell is Date {
  return cell instanceof Date && !Number.isNaN(cell.getTime());
}

/** A cell as the owner would see it in their sheet, trimmed, with spaces tidied. */
export function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "string") return cell.replace(/[\s ]+/g, " ").trim();
  if (typeof cell === "number") return Number.isFinite(cell) ? String(cell) : "";
  if (typeof cell === "boolean") return cell ? "TRUE" : "FALSE";
  if (isDate(cell)) return cell.toISOString().slice(0, 10);
  return "";
}

export function isBlankRow(row: readonly Cell[] | undefined): boolean {
  return !row || row.every((cell) => cellText(cell) === "");
}

/**
 * Lower case words and numbers only, for comparing headings and names:
 * "A/C unit (3-ton)" becomes "a c unit 3 ton".
 */
export function words(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/#/g, " # ")
    .replace(/[^a-z0-9#$]+/g, " ")
    .trim();
}

/** Quotes a cell's text for a note, shortened so a long cell doesn't take over the preview. */
export function quote(text: string, max = 40): string {
  return `"${text.length > max ? `${text.slice(0, max - 1)}…` : text}"`;
}

/** Cuts text to fit a length limit, ending in "…" when it was cut. */
export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** "a, b and c" */
export function listText(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** A spreadsheet's column letter: 0 is A, 25 is Z, 26 is AA. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}
