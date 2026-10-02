import {
  columnValues,
  findHeaderRow,
  guessColumns,
  guessLayout,
  headings,
  offersColumnLayout,
  type ColumnRole,
  type Layout,
} from "./columns";
import { isForecastCsv } from "./format";
import type { NameMatcher } from "./names";
import { dataRowCount, type ImportChoices, type Sheet } from "./preview";
import { MAX_ROWS, type FailReason } from "./read";
import type { Grid } from "./text";

/** A sheet with its headings found and its columns guessed. */
export interface OpenedSheet {
  sheet: Sheet;
  headings: string[];
  /** Two or more headings name library items, so "Each column is a component" is offered. */
  offersColumnLayout: boolean;
  layout: Layout;
  columns: ColumnRole[];
}

/**
 * Finds the headings below any title rows and guesses each column, or says why it
 * can't. This year tells a "Replacement year" column of past years from one of years to come.
 */
export function openSheet(grid: Grid, match: NameMatcher, currentYear: number): OpenedSheet | FailReason {
  const headerRow = findHeaderRow(grid, match);
  if (headerRow === null) return "no_header";
  const heads = headings(grid, headerRow);
  if (isForecastCsv(heads)) return "forecast_file";
  if (dataRowCount(grid, headerRow) > MAX_ROWS) return "too_big";
  const layout = guessLayout(heads, match);
  return {
    sheet: { grid, headerRow },
    headings: heads,
    offersColumnLayout: offersColumnLayout(heads, match),
    layout,
    columns: guessColumns(heads, match, layout, columnValues(grid, headerRow), currentYear),
  };
}

/** The guesses for a layout, when the owner switches to it. */
export function columnsFor(opened: OpenedSheet, match: NameMatcher, layout: Layout, currentYear: number): ColumnRole[] {
  const { grid, headerRow } = opened.sheet;
  return guessColumns(opened.headings, match, layout, columnValues(grid, headerRow), currentYear);
}

/** The choices a newly opened sheet starts with: the guesses, and this year as the sheet's year. */
export function startingChoices(opened: OpenedSheet, currentYear: number): ImportChoices {
  return { layout: opened.layout, columns: opened.columns, sheetYear: currentYear, answers: {}, fixes: {}, quantityAnswered: false };
}

/** The sheet's year as typed: a 4-digit year from 1900 to this year, or null. */
export function parseSheetYear(text: string, currentYear: number): number | null {
  const trimmed = text.trim();
  if (!/^\d{4}$/.test(trimmed)) return null;
  const year = Number(trimmed);
  return year >= 1900 && year <= currentYear ? year : null;
}
