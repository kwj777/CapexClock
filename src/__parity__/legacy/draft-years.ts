// FROZEN COPY of src/components/calculator/draft.ts at commit 94acb55 (main), kept so the engine refactor can be
// checked against today's math bit for bit. Do not edit: the "Today's numbers
// unchanged" check fails on any change here. Excerpt: only the year-built check the quick estimate uses, unchanged.

/** Null when blank; NaN when something was typed that isn't a number (e.g. "1.4k"). */
function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  return Number(cleaned);
}

/** Earliest install year a component can be given; older buildings use year built instead. */
export const EARLIEST_INSTALL_YEAR = 1900;
/** Earliest year built, matching the database. */
export const EARLIEST_YEAR_BUILT = 1800;

// Catches typos like "98" or "2106", which would otherwise read as long overdue or never due.
function isYearBetween(year: number, earliest: number, currentYear: number): boolean {
  return Number.isInteger(year) && year >= earliest && year <= currentYear;
}

/** True when year built is filled in but can't be a real year built. */
export function badYearBuilt(value: string, currentYear: number): boolean {
  const year = parseNumber(value);
  return year !== null && !isYearBetween(year, EARLIEST_YEAR_BUILT, currentYear);
}

export const YEAR_BUILT_TEXT = `Year built should be a 4-digit year from ${EARLIEST_YEAR_BUILT} to this year.`;
