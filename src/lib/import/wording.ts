import { CONDITION_TEXT, type DraftRow } from "@/components/calculator/draft";
import { formatUnitPrice } from "@/components/calculator/format";
import type { FixField, ImportedRow, Preview, PreviewRow, RowStatus, SkipReason, Skipped } from "./preview";
import { columnLetter, listText, quote } from "./text";

export { columnLetter };

export const STATUS_TEXT: Record<RowStatus, string> = {
  ready: "Ready",
  changed: "Changed",
  needs_you: "Needs you",
};

export const SKIP_TEXT: Record<SkipReason, string> = {
  above_headings: "above the headings",
  blank: "blank",
  repeated_headings: "the headings again",
  total: "a total row",
  section: "a section heading",
  no_name: "no item name or numbers",
  zero_quantity: "quantity 0",
  nothing_listed: "no items listed",
};

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/** "Row 4", "Rows 4–6 and 9": sheet row numbers with runs shortened, and long lists cut. */
export function rowNumbers(rows: readonly number[]): string {
  const sorted = [...new Set(rows)].sort((a, b) => a - b);
  const items: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let end = i;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end++;
    if (end - i >= 2) items.push(`${sorted[i]}–${sorted[end]}`);
    else for (let k = i; k <= end; k++) items.push(String(sorted[k]));
    i = end + 1;
  }
  const shown = items.length > 12 ? [...items.slice(0, 10), `${items.length - 10} more`] : items;
  return `${sorted.length === 1 ? "Row" : "Rows"} ${listText(shown)}`;
}

/** Skipped rows grouped by why: "Rows 1–2: above the headings". */
export function skippedLines(skipped: readonly Skipped[]): string[] {
  const byReason = new Map<SkipReason, number[]>();
  for (const s of skipped) {
    const rows = byReason.get(s.reason);
    if (rows) rows.push(s.sheetRow);
    else byReason.set(s.reason, [s.sheetRow]);
  }
  return [...byReason.entries()].map(([reason, rows]) => `${rowNumbers(rows)}: ${SKIP_TEXT[reason]}`);
}

/** "23 rows to add: 15 ready, 5 changed, 3 need you. 2 rows skipped." */
export function previewSummary(counts: Preview["counts"]): string {
  const parts: string[] = [];
  if (counts.ready > 0) parts.push(`${counts.ready.toLocaleString("en-US")} ready`);
  if (counts.changed > 0) parts.push(`${counts.changed.toLocaleString("en-US")} changed`);
  if (counts.needsYou > 0) parts.push(`${counts.needsYou.toLocaleString("en-US")} ${counts.needsYou === 1 ? "needs" : "need"} you`);
  const toAdd = counts.rows > 0 ? `${plural(counts.rows, "row")} to add: ${parts.join(", ")}.` : "No rows to add.";
  const skipped = counts.skipped > 0 ? ` ${plural(counts.skipped, "row")} skipped.` : "";
  return `${toAdd}${skipped}`;
}

export function addLabel(rows: number): string {
  return `Add ${plural(rows, "row")}`;
}

/** Rows to add that are already in the draft: the same library item, or the same name. */
export function duplicates(
  draftRows: readonly Pick<DraftRow, "librarySlug" | "name">[],
  rows: readonly PreviewRow[],
): { ids: Set<string>; names: string[] } {
  const slugs = new Set(draftRows.map((r) => r.librarySlug).filter((s): s is string => s !== null));
  const names = new Set(draftRows.map((r) => r.name.trim().toLowerCase()).filter(Boolean));
  const ids = new Set<string>();
  const found: string[] = [];
  for (const r of rows) {
    const { librarySlug, name } = r.row;
    const dup = librarySlug ? slugs.has(librarySlug) : name.trim() !== "" && names.has(name.trim().toLowerCase());
    if (!dup) continue;
    ids.add(r.id);
    if (!found.includes(name)) found.push(name);
  }
  return { ids, names: found };
}

/** The warning above Add when some items are already listed. */
export function duplicateText(names: readonly string[]): string {
  if (names.length === 0) return "";
  const shown = names.length > 5 ? [...names.slice(0, 5), plural(names.length - 5, "more item")] : [...names];
  const these = names.length === 1 ? "it" : "each";
  return `Your list already has ${listText(shown)}. Adding puts in another row for ${these}, so remove any you don't need.`;
}

/** One line of what a row will hold: "Qty 12 · Installed 2014 (guess) · Life 10 yrs (typical) · $1,400 each". */
export function detailsText(row: ImportedRow, lifeIsTypical: boolean): string {
  const parts: string[] = [];
  const quantity = Number(row.quantity);
  if (row.unitLabel === "per_sq_ft") {
    parts.push(Number.isFinite(quantity) ? `${quantity.toLocaleString("en-US")} sq ft` : `Sq ft ${quote(row.quantity)}`);
  } else {
    parts.push(Number.isFinite(quantity) ? `Qty ${quantity.toLocaleString("en-US")}` : `Qty ${quote(row.quantity)}`);
  }
  if (row.installYear === "") parts.push("Installed: year built (estimate)");
  else if (/^\d{4}$/.test(row.installYear)) parts.push(`Installed ${row.installYear}${row.installYearIsGuess ? " (guess)" : ""}`);
  else parts.push(`Installed ${quote(row.installYear)}`);
  if (row.usefulLife === "") parts.push("No useful life yet");
  else if (/^\d+$/.test(row.usefulLife)) parts.push(`Life ${row.usefulLife} yrs${lifeIsTypical ? " (typical)" : ""}`);
  else parts.push(`Life ${quote(row.usefulLife)}`);
  const cost = Number(row.costEach);
  if (row.costEach === "") parts.push("No cost yet");
  else if (Number.isFinite(cost)) parts.push(`${formatUnitPrice(cost)} ${row.unitLabel === "per_sq_ft" ? "per sq ft" : "each"}`);
  else parts.push(`Cost ${quote(row.costEach)}`);
  if (row.condition) parts.push(`${CONDITION_TEXT[row.condition]} condition`);
  return parts.join(" · ");
}

/** What's left to do, under the summary. */
export function previewHints(preview: Preview): string[] {
  const hints: string[] = [];
  if (preview.missingItemColumn) hints.push("Choose which column has the item names.");
  // While the units question is open, it says what happens instead.
  if (preview.noQuantityColumn && !preview.missingItemColumn && preview.unitsQuestion?.answer !== null) {
    hints.push(
      preview.quantityFromTotals
        ? "There's no quantity column, so we worked out quantities from the totals where they divide evenly. Other rows count as one, and identical rows are added up."
        : "There's no quantity column, so each row counts as one, and identical rows are added up.",
    );
  }
  if (preview.doubtfulQuantity) {
    const { column, heading } = preview.doubtfulQuantity;
    hints.push(
      `We used column ${columnLetter(column)}, ${quote(heading)}, as the quantity. If it numbers the rows or apartments instead, set it to Ignore.`,
    );
  }
  if (preview.noYearColumn && !preview.missingItemColumn) {
    hints.push(
      "No column has install years, so each item uses the year built, marked an estimate. If one does, choose Install year for it above.",
    );
  }
  for (const { column, heading, role } of preview.doubtfulYears) {
    const named = `column ${columnLetter(column)}, ${quote(heading)}`;
    hints.push(
      role === "installYear"
        ? `We read ${named}, as when each item was installed or last replaced. If it's another date, like a service date or the year to replace by, change it above.`
        : `We read ${named}, as the year to replace each item by. If it's when each item was last replaced, choose Install year for it above.`,
    );
  }
  if (preview.withoutCost > 0) {
    hints.push(
      `${plural(preview.withoutCost, "row has", "rows have")} no cost yet. Add costs after importing to include ${
        preview.withoutCost === 1 ? "it" : "them"
      } in the forecast.`,
    );
  }
  return hints;
}

/** The calculator re-draws every row as you type, so past this many rows it starts to lag. */
export const SLOW_ROWS = 300;

/** The warning above Add when the list would get long enough to slow the calculator, or "" when it won't. */
export function longListText(rowsNow: number, adding: number): string {
  const total = rowsNow + adding;
  if (adding === 0 || total <= SLOW_ROWS) return "";
  const makes = rowsNow > 0 ? `Adding these makes ${plural(total, "row")} in your list` : `That's ${plural(total, "row")}`;
  return `${makes}, and the calculator gets slow past about ${SLOW_ROWS}. Typing may lag. To keep it quick, put each item on one row with a quantity, or import part of the sheet at a time.`;
}

/** The units question: "Column B, "Units", says 12 on every row. What is it?" */
export function unitsQuestionText(question: NonNullable<Preview["unitsQuestion"]>): string {
  return `Column ${columnLetter(question.column)}, ${quote(question.heading)}, says ${question.value} on every row. What is it?`;
}

/** The label of each field the preview lets the owner fix. */
export const FIX_LABEL: Record<FixField, string> = {
  name: "Item name",
  quantity: "Quantity",
  installYear: "Install year",
  usefulLife: "Useful life (years)",
  costEach: "Cost each",
};
