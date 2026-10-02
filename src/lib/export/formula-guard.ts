// Spreadsheet apps run a cell starting with = + - or @ as a formula. Apps set
// to split on ";" or tabs (common in Europe) also start a new cell inside ours
// at those characters, and spaces or quotes before the formula don't stop it.
// An apostrophe in front keeps it plain text, so "=HYPERLINK(...)" stays a name.
const FORMULA = /((?:^|[,;\t|\r\n])[\s"]*)([=+\-@])/g;
// Some apps also treat a cell starting with a tab or carriage return as a formula.
const CONTROL_START = /^[\t\r]/;

/** Text as our CSV files write it, with an apostrophe before anything a spreadsheet app could run. */
export function guardFormulas(text: string): string {
  const guarded = text.replace(FORMULA, "$1'$2");
  return CONTROL_START.test(guarded) ? `'${guarded}` : guarded;
}

const GUARDED = /((?:^|[,;\t|\r\n])[\s"]*)'([=+\-@])/g;
const GUARDED_CONTROL = /^'(?=[\t\r])/;

/**
 * Takes off the apostrophes guardFormulas added, for text read back from one of
 * our files: opened and saved again, they stay in the cells.
 */
export function removeFormulaGuards(text: string): string {
  return text.replace(GUARDED_CONTROL, "").replace(GUARDED, "$1$2");
}
