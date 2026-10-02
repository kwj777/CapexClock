import type { NameMatcher } from "./names";
import { cellText, isBlankRow, words, type Grid } from "./text";

/** What a column holds. */
export type FieldKind =
  | "item"
  | "quantity"
  | "location"
  | "installYear"
  | "age"
  | "life"
  | "remaining"
  | "replaceBy"
  | "cost"
  | "total"
  | "condition"
  | "notes"
  | "category";

/** A column's use: a field, nothing, or (each column is a component) one library item. */
export type ColumnRole = "ignore" | FieldKind | `component:${string}`;

/**
 * "rows": one row per item. "columns": one row per apartment, with a column per
 * item ("Apt | Water heater installed | Furnace installed").
 */
export type Layout = "rows" | "columns";

/** The choices in each column's dropdown, in order, with what the owner reads. */
export const FIELD_TEXT: Record<FieldKind, string> = {
  item: "Item name",
  quantity: "Quantity",
  location: "Apartment or location",
  installYear: "Install year",
  age: "Age in years",
  life: "Useful life",
  remaining: "Years of life left",
  replaceBy: "Replace by year",
  cost: "Cost each",
  total: "Total cost",
  condition: "Condition",
  notes: "Notes",
  category: "Category",
};

export const FIELDS = Object.keys(FIELD_TEXT) as FieldKind[];

/** Fields the "each column is a component" layout reads besides the components. */
export const COLUMN_LAYOUT_FIELDS: readonly FieldKind[] = ["location"];

// Whole headings, after words(): checked before the keyword rules below. Null means
// the heading is about something else (the building, a tenant), so it's left out.
const EXACT: Record<string, FieldKind | null> = {
  "qty": "quantity",
  "count": "quantity",
  "how many": "quantity",
  "unit": "location",
  "unit #": "location",
  "unit no": "location",
  "unit number": "location",
  "apt": "location",
  "apt #": "location",
  "apt no": "location",
  "apartment": "location",
  "suite": "location",
  "door": "location",
  "location": "location",
  "where": "location",
  "room": "location",
  "year": "installYear",
  "yr": "installYear",
  "date": "installYear",
  "when": "installYear",
  "eul": "life",
  "rul": "remaining",
  "due": "replaceBy",
  "$": "cost",
  "each": "cost",
  "price": "cost",
  "amount": "cost",
  "total": "total",
  "cond": "condition",
  "rating": "condition",
  "what": "item",
  "name": "item",
  // Row and reference numbers, not items or quantities.
  "item #": null,
  "item no": null,
  "item number": null,
  "line": null,
  "line #": null,
  "line no": null,
  "row": null,
  "row #": null,
  "ref": null,
  "ref #": null,
  "id": null,
  // Step 5 reads these for the property itself; here they're left out.
  "units": null,
  "building": null,
  "bldg": null,
  "property": null,
  "address": null,
};

// A Map, so a heading like "constructor" can't find Object's own keys.
const EXACT_HEADINGS = new Map(Object.entries(EXACT));

/**
 * How sure a heading is about its kind. A weak one ("Year") gives way to a sure one
 * ("Year installed") in another column. A doubtful one is named in the preview so
 * the owner can check it: a bare "Date" may be a service date, and "Replacement
 * year" may be when an item was last replaced or when it's due.
 */
export type Strength = "sure" | "weak" | "doubtful";

const RANK: Record<Strength, number> = { sure: 2, weak: 1, doubtful: 0 };

const EXACT_STRENGTH = new Map<string, Strength>([
  ["year", "weak"],
  ["yr", "weak"],
  ["date", "doubtful"],
  ["when", "doubtful"],
]);

/**
 * Keyword rules, in order: the first one whose words are all in the heading wins.
 * Null rules come first: tenant details and the year built are never read.
 */
const RULES: [FieldKind | null, string[], Strength?][] = [
  [null, ["tenant"]],
  [null, ["tenants"]],
  [null, ["resident"]],
  [null, ["occupant"]],
  [null, ["phone"]],
  [null, ["email"]],
  [null, ["rent"]],
  [null, ["lease"]],
  [null, ["move"]],
  [null, ["built"]],
  [null, ["warranty"]],
  [null, ["sq", "ft"]],
  ["total", ["total"]],
  ["total", ["extended"]],
  ["total", ["ext", "cost"]],
  ["cost", ["cost"]],
  ["cost", ["price"]],
  ["replaceBy", ["budget", "year"]],
  ["cost", ["budget"]],
  ["cost", ["$"]],
  ["remaining", ["remaining"]],
  ["remaining", ["left"]],
  ["remaining", ["rul"]],
  ["life", ["eul"]],
  ["life", ["life"]],
  ["life", ["lifespan"]],
  ["life", ["expectancy"]],
  ["age", ["age"]],
  ["age", ["old"]],
  ["age", ["years", "since"]],
  ["age", ["yrs", "since"]],
  ["age", ["years", "in", "service"]],
  ["age", ["yrs", "in", "service"]],
  ["quantity", ["qty"]],
  ["quantity", ["quantity"]],
  // A past replacement is an install year: "Date of last replacement", "Install/replace year".
  ["installYear", ["install"]],
  ["installYear", ["installed"]],
  ["installYear", ["installation"]],
  ["installYear", ["last", "replacement"]],
  ["installYear", ["last", "replace"]],
  ["installYear", ["previous", "replacement"]],
  ["installYear", ["prior", "replacement"]],
  ["installYear", ["recent", "replacement"]],
  ["installYear", ["in", "service"]],
  ["replaceBy", ["replace", "by"]],
  ["replaceBy", ["replace", "year"]],
  ["replaceBy", ["replace", "in"]],
  ["replaceBy", ["next", "replacement"]],
  ["replaceBy", ["due"]],
  ["replaceBy", ["end", "of"]],
  ["replaceBy", ["planned"]],
  ["replaceBy", ["scheduled"]],
  ["replaceBy", ["projected"]],
  ["replaceBy", ["target"]],
  // Reserve studies mean the year it's due; an owner's own list may mean the last one.
  ["replaceBy", ["replacement", "year"], "doubtful"],
  ["replaceBy", ["replacement", "yr"], "doubtful"],
  ["replaceBy", ["replacement", "date"], "doubtful"],
  ["installYear", ["replaced"]],
  ["installYear", ["purchased"]],
  ["installYear", ["purchase"]],
  ["installYear", ["bought"]],
  ["installYear", ["year"], "weak"],
  ["installYear", ["yr"], "weak"],
  ["installYear", ["date"], "doubtful"],
  ["quantity", ["count"]],
  ["quantity", ["number", "of"]],
  ["quantity", ["#", "of"]],
  ["quantity", ["no", "of"]],
  ["condition", ["condition"]],
  ["notes", ["note"]],
  ["notes", ["notes"]],
  ["notes", ["comment"]],
  ["notes", ["comments"]],
  ["notes", ["remarks"]],
  ["notes", ["details"]],
  ["notes", ["memo"]],
  ["notes", ["brand"]],
  ["notes", ["make"]],
  ["notes", ["model"]],
  ["notes", ["serial"]],
  ["category", ["category"]],
  ["category", ["group"]],
  ["category", ["system"]],
  ["location", ["apt"]],
  ["location", ["apartment"]],
  ["location", ["unit", "#"]],
  ["item", ["item"]],
  ["item", ["items"]],
  ["item", ["component"]],
  ["item", ["components"]],
  ["item", ["description"]],
  ["item", ["equipment"]],
  ["item", ["asset"]],
  ["item", ["assets"]],
];

/**
 * Things done to an item that don't replace it. A heading with one of these, like
 * "Last service date", "Date inspected" or "Repair cost", isn't an install year,
 * an age or a replacement cost, so it's left out. "Service life" is still a life.
 */
const EVENT_WORDS = new Set(
  "service serviced servicing inspection inspections inspected inspect insp maintenance maintained maint tested test testing checked cleaned cleaning repaired repair repairs pumped".split(
    " ",
  ),
);
const EVENT_BLOCKS = new Set<FieldKind>(["installYear", "replaceBy", "age", "cost", "total", "quantity"]);

/** A heading's field and how sure it is, or null for a heading that isn't read. */
export function guessHeading(heading: string): { field: FieldKind | null; strength: Strength } {
  const text = words(heading);
  if (text === "") return { field: null, strength: "sure" };
  const exact = EXACT_HEADINGS.get(text);
  if (exact !== undefined) return { field: exact, strength: EXACT_STRENGTH.get(text) ?? "sure" };
  const have = text.split(" ");
  for (const [field, needed, strength = "sure"] of RULES) {
    if (!needed.every((w) => have.includes(w))) continue;
    // "Service" in "Years in service" is the rule's own word; in "Service date" it isn't.
    const event = have.some((w) => EVENT_WORDS.has(w) && !needed.includes(w));
    if (field !== null && EVENT_BLOCKS.has(field) && event) return { field: null, strength: "sure" };
    return { field, strength };
  }
  return { field: null, strength: "sure" };
}

/** The field a heading names, or null: "Year installed" is installYear, "Unit" is a location. */
export function guessField(heading: string): FieldKind | null {
  return guessHeading(heading).field;
}

// Headings that might number the rows or apartments rather than count anything.
const NUMBER_HEADINGS = new Set(["#", "no", "number", "num", "nbr"]);

/**
 * A heading that might be a quantity but might not: "#" or "No." often numbers the
 * rows, and "Units" can be the building's unit count. These are used only when no
 * heading names a quantity, and only if the values look like counts.
 */
export function doubtfulQuantity(heading: string): "number" | "units" | null {
  const text = words(heading);
  if (NUMBER_HEADINGS.has(text)) return "number";
  if (text === "units") return "units";
  return null;
}

/** Values that run 1, 2, 3 (or 101, 102, 103) down the sheet number the rows or apartments. */
export function isCounting(values: readonly string[]): boolean {
  const numbers = values.map((v) => (/^\d{1,6}\.?$/.test(v) ? Number.parseInt(v, 10) : Number.NaN));
  if (numbers.length < 3 || numbers.some(Number.isNaN)) return false;
  return numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1);
}

// Words that say when, in a heading like "Water heater installed" or "WH age".
const TIMING_WORDS = new Set(
  "installed install installation year yr yrs date age old replaced last when in purchased purchase bought".split(" "),
);

/** How a component column's cells give the install year. */
export type Timing = "installYear" | "age";

/** "Water heater installed" names an item; "age" in it means its cells are ages. */
export function headingTiming(heading: string): Timing {
  const have = new Set(words(heading).split(" "));
  return have.has("age") || have.has("old") ? "age" : "installYear";
}

/** The library item a heading names, if sure: "Water heater installed" is Tank water heater. */
export function headingItem(heading: string, match: NameMatcher): string | null {
  const all = words(heading).split(" ");
  // "Water heater service date" holds service dates, not install years.
  if (all.some((w) => EVENT_WORDS.has(w))) return null;
  const rest = all.filter((w) => !TIMING_WORDS.has(w)).join(" ");
  if (rest === "") return null;
  const found = match(rest);
  return found.kind === "exact" || found.kind === "matched" ? found.slug : null;
}

/** How many cells in a row look like headings. */
function headingScore(row: Grid[number], match: NameMatcher): number {
  let score = 0;
  for (const cell of row) {
    const text = cellText(cell);
    // Long text is a title or a note, not a heading.
    if (text === "" || text.length > 60 || /^[\d$.,\s-]+$/.test(text)) continue;
    if (guessField(text) !== null || doubtfulQuantity(text) !== null || headingItem(text, match) !== null) score += 1;
  }
  return score;
}

/** How far down to look for the headings, past a title block. */
export const HEADER_SEARCH_ROWS = 30;

/**
 * The row of headings: the one in the first 30 rows with the most cells that look
 * like headings, and at least 2. Title rows above it are skipped. Null when no row does.
 */
export function findHeaderRow(grid: Grid, match: NameMatcher): number | null {
  let best: number | null = null;
  let bestScore = 1;
  for (let i = 0; i < Math.min(grid.length, HEADER_SEARCH_ROWS); i++) {
    if (isBlankRow(grid[i])) continue;
    const score = headingScore(grid[i], match);
    if (score > bestScore) [best, bestScore] = [i, score];
  }
  return best;
}

/** The headings, one per column across the widest row. */
export function headings(grid: Grid, headerRow: number): string[] {
  const width = Math.max(0, ...grid.map((r) => r.length));
  return Array.from({ length: width }, (_, i) => cellText(grid[headerRow]?.[i]));
}

/** Library items named by the headings, by column, for "Each column is a component". */
export function componentColumns(heads: readonly string[], match: NameMatcher): (string | null)[] {
  return heads.map((h) => (guessField(h) === "location" ? null : headingItem(h, match)));
}

/** Two or more headings name library items, so each column could be a component. */
export function offersColumnLayout(heads: readonly string[], match: NameMatcher): boolean {
  return componentColumns(heads, match).filter(Boolean).length >= 2;
}

/** The layout to start with: columns of items when there's no item name column. */
export function guessLayout(heads: readonly string[], match: NameMatcher): Layout {
  if (!offersColumnLayout(heads, match)) return "rows";
  return guessColumns(heads, match, "rows").includes("item") ? "rows" : "columns";
}

/** The values under each heading, by column, for guesses that need to see them. */
export type ColumnValues = (column: number) => readonly string[];

/** Every filled cell under the headings, column by column. */
export function columnValues(grid: Grid, headerRow: number): ColumnValues {
  const cache = new Map<number, string[]>();
  return (column) => {
    let values = cache.get(column);
    if (!values) {
      values = [];
      for (let i = headerRow + 1; i < grid.length; i++) {
        const text = cellText(grid[i]?.[column]);
        if (text !== "") values.push(text);
      }
      cache.set(column, values);
    }
    return values;
  };
}

/** Every year named in a column is before this year, so none of them can still be due. */
export function yearsHavePassed(values: readonly string[], currentYear: number): boolean {
  let found = false;
  for (const value of values) {
    const years = value.match(/(?<!\d)(?:1[89]\d\d|2\d\d\d)(?!\d)/g);
    if (!years) {
      // "ASAP" or "next year" says the column is about what's coming.
      if (/\b(?:now|asap|due|overdue|next|soon)\b/i.test(value)) return false;
      continue;
    }
    if (years.some((y) => Number(y) >= currentYear)) return false;
    found = true;
  }
  return found;
}

/** Numbers only, like "12" or "1,200". */
const PLAIN_NUMBER = /^\d[\d,]*(?:\.\d+)?$/;

/**
 * A role for each column, from its heading. Only one column of each kind is used
 * (notes columns are all kept): the surest heading, or the first of equally sure
 * ones, so "Year installed" wins over a bare "Date". A "#", "No." or "Units" column
 * is the quantity only when no heading names one and its values look like counts.
 * With no item column, a "System" column holds the item names. A "Replacement year"
 * column whose years have all gone by (before `currentYear`) is read as when each
 * item was last replaced.
 */
export function guessColumns(
  heads: readonly string[],
  match: NameMatcher,
  layout: Layout,
  values: ColumnValues = () => [],
  currentYear?: number,
): ColumnRole[] {
  const items = componentColumns(heads, match);
  const guesses = heads.map((heading, i): { role: ColumnRole; rank: number } => {
    const { field, strength } = guessHeading(heading);
    let role: ColumnRole;
    if (layout === "columns") {
      const slug = items[i];
      role = slug ? `component:${slug}` : field && COLUMN_LAYOUT_FIELDS.includes(field) ? field : "ignore";
    } else {
      // A heading that names an item belongs to the other layout.
      role = items[i] ? "ignore" : (field ?? "ignore");
    }
    return { role, rank: RANK[strength] };
  });
  const many = (role: ColumnRole) => role === "ignore" || role === "notes" || role.startsWith("component:");
  const chosen = new Map<ColumnRole, number>();
  guesses.forEach(({ role, rank }, i) => {
    if (many(role)) return;
    const at = chosen.get(role);
    if (at === undefined || rank > guesses[at].rank) chosen.set(role, i);
  });
  const roles = guesses.map(({ role }, i): ColumnRole => (many(role) || chosen.get(role) === i ? role : "ignore"));

  if (layout === "columns") {
    // "#" or "No." in a sheet of apartments is the apartment number.
    if (!roles.includes("location")) {
      const at = heads.findIndex((h, i) => roles[i] === "ignore" && doubtfulQuantity(h) === "number");
      if (at >= 0) roles[at] = "location";
    }
    return roles;
  }

  if (!roles.includes("quantity")) {
    const at = heads.findIndex((h, i) => {
      const kind = doubtfulQuantity(h);
      if (roles[i] !== "ignore" || kind === null) return false;
      const cells = values(i);
      if (cells.length === 0 || !cells.every((v) => PLAIN_NUMBER.test(v)) || isCounting(cells)) return false;
      // The same number on every row may be the building's unit count: the preview asks.
      return kind === "number" || new Set(cells).size > 1;
    });
    if (at >= 0) roles[at] = "quantity";
  }
  if (!roles.includes("item")) {
    const at = heads.findIndex(
      (h, i) => (roles[i] === "category" || roles[i] === "ignore") && guessField(h) === "category" && /\bsystems?\b/.test(words(h)),
    );
    if (at >= 0) roles[at] = "item";
  }
  const due = roles.indexOf("replaceBy");
  if (
    due >= 0 &&
    currentYear !== undefined &&
    !roles.includes("installYear") &&
    guessHeading(heads[due]).strength === "doubtful" &&
    yearsHavePassed(values(due), currentYear)
  ) {
    roles[due] = "installYear";
  }
  return roles;
}

/** The quantity column, when its heading only might be one ("#", "No.", "Units"). */
export function doubtfulQuantityColumn(heads: readonly string[], columns: readonly ColumnRole[]): number | null {
  const at = columns.indexOf("quantity");
  return at >= 0 && guessField(heads[at] ?? "") === null && doubtfulQuantity(heads[at] ?? "") !== null ? at : null;
}

/**
 * A "Units" column with the same number (not 1) on every row, when no other column
 * is the quantity. It could be how many of each item there are, or the building's
 * unit count, so the preview asks which.
 */
export function sameUnitsColumn(
  heads: readonly string[],
  columns: readonly ColumnRole[],
  values: ColumnValues,
): { column: number; value: string } | null {
  const column = heads.findIndex(
    (h, i) => doubtfulQuantity(h) === "units" && (columns[i] === "ignore" || columns[i] === "quantity"),
  );
  if (column < 0 || columns.some((r, i) => r === "quantity" && i !== column)) return null;
  const cells = values(column);
  if (cells.length === 0 || !cells.every((v) => PLAIN_NUMBER.test(v)) || new Set(cells).size > 1) return null;
  return Number(cells[0].replace(/,/g, "")) === 1 ? null : { column, value: cells[0] };
}

/** Install-year and replace-by columns whose headings could mean something else, for the preview to name. */
export function doubtfulYearColumns(
  heads: readonly string[],
  columns: readonly ColumnRole[],
): { column: number; heading: string; role: "installYear" | "replaceBy" }[] {
  const found: { column: number; heading: string; role: "installYear" | "replaceBy" }[] = [];
  columns.forEach((role, column) => {
    if ((role === "installYear" || role === "replaceBy") && guessHeading(heads[column] ?? "").strength === "doubtful") {
      found.push({ column, heading: heads[column], role });
    }
  });
  return found;
}

/** The library slug of a component column's role, or null. */
export function componentSlug(role: ColumnRole): string | null {
  return role.startsWith("component:") ? role.slice("component:".length) : null;
}

/** A few values from under a heading, so the owner can tell what the column holds. */
export function samples(grid: Grid, headerRow: number, column: number, count = 3): string[] {
  const found: string[] = [];
  for (let i = headerRow + 1; i < grid.length && found.length < count; i++) {
    const text = cellText(grid[i]?.[column]);
    if (text !== "" && !found.includes(text)) found.push(text);
  }
  return found;
}

/** A dropdown's value back as a role; anything unknown is "ignore". */
export function parseRole(value: string): ColumnRole {
  if ((FIELDS as string[]).includes(value)) return value as FieldKind;
  if (value.startsWith("component:") && value.length > "component:".length) return value as `component:${string}`;
  return "ignore";
}
