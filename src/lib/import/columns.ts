import { formatField, isCapexClockFormat } from "./format";
import type { NameMatcher } from "./names";
import { cellText, isBlankRow, words, type Grid } from "./text";
import { isYesNo, readUnitCount } from "./values";

/** What a column holds. */
export type FieldKind =
  | "item"
  | "category"
  | "quantity"
  | "countedPer"
  | "area"
  | "location"
  | "installYear"
  | "guess"
  | "age"
  | "life"
  | "remaining"
  | "replaceBy"
  | "cost"
  | "total"
  | "condition"
  | "replaceNow"
  | "notes"
  | "building"
  | "unitCount"
  | "yearBuilt"
  | "id";

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
  category: "Category",
  quantity: "Quantity",
  countedPer: "Counted per (unit, building or sq ft)",
  area: "Square feet",
  location: "Apartment or location",
  installYear: "Install year",
  guess: "Install year is a guess (yes or no)",
  age: "Age in years",
  life: "Useful life",
  remaining: "Years of life left",
  replaceBy: "Replace by year",
  cost: "Cost each",
  total: "Total cost",
  condition: "Condition",
  replaceNow: "Replace now (yes or no)",
  notes: "Notes",
  building: "Building",
  unitCount: "Building's unit count",
  yearBuilt: "Year built",
  id: "CapexClock ID",
};

export const FIELDS = Object.keys(FIELD_TEXT) as FieldKind[];

/** Fields about the building, not each item: one value per building. */
export const BUILDING_FIELDS: readonly FieldKind[] = ["building", "unitCount", "yearBuilt"];

/** Fields the "each column is a component" layout reads besides the components. */
export const COLUMN_LAYOUT_FIELDS: readonly FieldKind[] = ["location", "building"];

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
  // Our own template's headings (see format.ts), and ways of saying the same.
  "counted per": "countedPer",
  "counted": "countedPer",
  "per": "countedPer",
  "install year is a guess": "guess",
  "guess": "guess",
  "guessed": "guess",
  "replace now": "replaceNow",
  "replace this year": "replaceNow",
  "capexclock id": "id",
  "building": "building",
  "building name": "building",
  "bldg": "building",
  "bldg name": "building",
  "property": "building",
  "property name": "building",
  "units in building": "unitCount",
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
  // "Units" may count items or the building's units: see doubtfulQuantity. An
  // address may be each apartment's, so it isn't read as the building.
  "units": null,
  "address": null,
};

// A Map, so a heading like "constructor" can't find Object's own keys.
const EXACT_HEADINGS = new Map(Object.entries(EXACT));

/** A heading that says its column is in square feet: "Qty (sq ft)", "Cost/SF", "$ psf". */
export function headingSaysSqFt(heading: string): boolean {
  return /\b(?:sq\.?\s*f(?:t|ee?t)|sf|sqft|psf|square\s+f(?:ee|oo)t|ft2)\b|ft²/i.test(heading);
}

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

// Words that make a heading in square feet a cost or a count, not an area: "Cost/SF", "Qty SF".
const MONEY_OR_COUNT = new Set(["cost", "price", "$", "budget", "amount", "value", "qty", "quantity", "count"]);
// Words that make it the size of an apartment or the building: "Unit SF", "Bldg sq ft".
const PLACE_WORDS = new Set(
  "apartment apartments apt apts unit units building bldg rentable leasable living gross suite property house home".split(" "),
);

/** The heading says square feet: "Sq ft", "SF", "Square footage", "ft²". */
function inSquareFeet(have: readonly string[]): boolean {
  const has = (w: string) => have.includes(w);
  return (
    ((has("sq") || has("square") || has("area")) && (has("ft") || has("feet") || has("foot") || has("footage"))) ||
    has("sf") ||
    has("sqft") ||
    has("ft2")
  );
}

/** An area in square feet, not a cost or a count in them. */
function areaWords(have: readonly string[]): boolean {
  return inSquareFeet(have) && !have.some((w) => MONEY_OR_COUNT.has(w));
}

/**
 * Keyword rules, in order: the first one whose words are all in the heading wins
 * (or, for a test, that passes it). Null rules come first: tenant details and the
 * year built are never read.
 */
const RULES: [FieldKind | null, string[] | ((have: readonly string[]) => boolean), Strength?][] = [
  [null, ["tenant"]],
  [null, ["tenants"]],
  [null, ["resident"]],
  [null, ["occupant"]],
  [null, ["phone"]],
  [null, ["email"]],
  [null, ["rent"]],
  [null, ["lease"]],
  [null, ["move"]],
  ["yearBuilt", ["year", "built"]],
  ["yearBuilt", ["yr", "built"]],
  ["yearBuilt", ["date", "built"]],
  [null, ["built"]],
  [null, ["warranty"]],
  // A cost or quantity in square feet is read, and so is an item's area ("Area (SF)"),
  // but not an apartment's or the building's size.
  ["cost", ["cost", "sq", "ft"]],
  ["cost", ["$", "sq", "ft"]],
  ["cost", ["price", "sq", "ft"]],
  ["quantity", ["qty", "sq", "ft"]],
  ["quantity", ["quantity", "sq", "ft"]],
  [null, (have) => areaWords(have) && have.some((w) => PLACE_WORDS.has(w))],
  ["area", areaWords],
  // "Total units" and "Total qty" count items; "Total cost (all units)" is money.
  ["total", ["total", "cost"]],
  ["total", ["total", "price"]],
  ["total", ["total", "$"]],
  ["quantity", ["total", "units"]],
  ["quantity", ["total", "qty"]],
  ["quantity", ["total", "quantity"]],
  ["quantity", ["total", "count"]],
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

// Words that say a value is a guess: "Year installed (guess)", or a yes or no column like "Guess?".
const GUESS_WORDS = new Set(["guess", "guessed"]);

/** The heading says "guess": "Year installed (guess)", "Install year guess", "Guessed?". */
export function headingSaysGuess(heading: string): boolean {
  return words(heading).split(" ").some((w) => GUESS_WORDS.has(w));
}

/** A heading's field and how sure it is, or null for a heading that isn't read. */
export function guessHeading(heading: string): { field: FieldKind | null; strength: Strength } {
  const text = words(heading);
  if (text === "") return { field: null, strength: "sure" };
  const exact = EXACT_HEADINGS.get(text);
  if (exact !== undefined) return { field: exact, strength: EXACT_STRENGTH.get(text) ?? "sure" };
  const have = text.split(" ");
  if (have.some((w) => GUESS_WORDS.has(w))) {
    // "Year installed (guess)" and "Install yr - best guess" hold years. A heading
    // that names nothing else, like "Guess?", is a yes or no next to the install
    // year, and so is "Install year guess" when its cells say yes or no (see guessColumns).
    const rest = have.filter((w) => !GUESS_WORDS.has(w)).join(" ");
    const other = rest === "" ? null : guessHeading(rest);
    return other && other.field !== null ? other : { field: "guess", strength: "sure" };
  }
  for (const [field, needed, strength = "sure"] of RULES) {
    if (typeof needed === "function" ? !needed(have) : !needed.every((w) => have.includes(w))) continue;
    // "Service" in "Years in service" is the rule's own word; in "Service date" it isn't.
    const own = typeof needed === "function" ? [] : needed;
    const event = have.some((w) => EVENT_WORDS.has(w) && !own.includes(w));
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
 * rows, and "Units" can be the building's unit count or the apartment numbers. The
 * guesses leave these out, and the preview asks about them (see quantityQuestionColumn).
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

/** A component heading without its timing words: "Water heater 2 installed" is "water heater 2". */
function itemWords(heading: string): string {
  return words(heading)
    .split(" ")
    .filter((w) => !TIMING_WORDS.has(w))
    .join(" ");
}

/** Two install-year columns whose names differ by a number, like "Fridge 1" and "Fridge 2", are separate items. */
function separateItems(a: string, b: string): boolean {
  if (headingTiming(a) !== "installYear" || headingTiming(b) !== "installYear") return false;
  const [x, y] = [itemWords(a), itemWords(b)];
  return x !== y && /\d/.test(`${x} ${y}`);
}

/**
 * Two columns about one item, like "Water heater installed" and "Water heater age",
 * would count it twice for each apartment. One is kept, an install year over an age,
 * else the first, and the others are set to Ignore, where the owner can change them.
 */
function keepOneColumnPerItem(heads: readonly string[], roles: ColumnRole[]) {
  const kept = new Map<string, number[]>();
  roles.forEach((role, i) => {
    const slug = componentSlug(role);
    if (!slug) return;
    const others = kept.get(slug) ?? [];
    const same = others.find((k) => !separateItems(heads[k], heads[i]));
    if (same === undefined) {
      kept.set(slug, [...others, i]);
    } else if (headingTiming(heads[same]) === "age" && headingTiming(heads[i]) === "installYear") {
      roles[same] = "ignore";
      kept.set(slug, others.map((k) => (k === same ? i : k)));
    } else {
      roles[i] = "ignore";
    }
  });
}

/**
 * Columns left out because another column gives the same item for each apartment,
 * for the preview to name. `kept` is that other column.
 */
export function sameItemColumns(
  heads: readonly string[],
  columns: readonly ColumnRole[],
  match: NameMatcher,
): { column: number; kept: number; slug: string }[] {
  const found: { column: number; kept: number; slug: string }[] = [];
  columns.forEach((role, column) => {
    if (role !== "ignore") return;
    const slug = headingItem(heads[column] ?? "", match);
    const kept = slug ? columns.indexOf(`component:${slug}`) : -1;
    if (slug && kept >= 0) found.push({ column, kept, slug });
  });
  return found;
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

/** Each building's filled cells in a column, building by building, for guesses that compare buildings. */
export type BuildingValues = (column: number) => readonly (readonly string[])[];

/**
 * Every filled cell under the headings, split by the building in `buildingColumn`. A
 * row belongs to the building it names, or to the last one named above it, as with
 * merged cells. Names match whatever their case and punctuation.
 */
export function buildingValues(grid: Grid, headerRow: number, buildingColumn: number): BuildingValues {
  // The building each row belongs to, worked out once.
  const owners: string[] = [];
  let building = "";
  for (let i = headerRow + 1; i < grid.length; i++) {
    const named = cellText(grid[i]?.[buildingColumn]);
    if (named !== "") building = words(named);
    owners.push(building);
  }
  return (column) => {
    const groups = new Map<string, string[]>();
    owners.forEach((owner, k) => {
      const text = cellText(grid[headerRow + 1 + k]?.[column]);
      if (text === "") return;
      const group = groups.get(owner);
      if (group) group.push(text);
      else groups.set(owner, [text]);
    });
    return [...groups.values()];
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

/** Every filled cell says yes or no, and there's at least one. */
function isYesNoColumn(values: readonly string[]): boolean {
  return values.length > 0 && values.every(isYesNo);
}

/** Numbers only, like "12" or "1,200". */
const PLAIN_NUMBER = /^\d[\d,]*(?:\.\d+)?$/;

/** Every filled cell is a number, perhaps in square feet ("9,600 sf"), and there's at least one. */
function isAreaColumn(values: readonly string[]): boolean {
  return values.length > 0 && values.every((v) => /^\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft\.?|sf|sqft|square\s+f(?:ee|oo)t)?$/i.test(v));
}

/**
 * A role for each column, from its heading. Only one column of each kind is used
 * (notes columns are all kept): the surest heading, or the first of equally sure
 * ones, so "Year installed" wins over a bare "Date". In our own format (format.ts)
 * every heading is read as the format says, so "Units" is the building's unit count.
 * Elsewhere a "#", "No." or "Units" column is left out here, and the preview asks
 * whether it's the quantity.
 * With no item column, a "System" column holds the item names. A "Replacement year"
 * column whose years have all gone by (before `currentYear`) is read as when each
 * item was last replaced. A heading with "guess" in it is the yes or no beside the
 * install year when its cells say yes or no, and otherwise what the rest of it says.
 */
export function guessColumns(
  heads: readonly string[],
  match: NameMatcher,
  layout: Layout,
  values: ColumnValues = () => [],
  currentYear?: number,
): ColumnRole[] {
  const items = componentColumns(heads, match);
  // Our own template and downloads: their headings mean exactly what they say.
  const ours = layout === "rows" && isCapexClockFormat(heads);
  const guesses = heads.map((heading, i): { role: ColumnRole; rank: number } => {
    const own = ours ? formatField(heading) : null;
    if (own) return { role: own, rank: RANK.sure };
    const { field, strength } = guessHeading(heading);
    let role: ColumnRole;
    if (layout === "columns") {
      const slug = items[i];
      role = slug ? `component:${slug}` : field && COLUMN_LAYOUT_FIELDS.includes(field) ? field : "ignore";
    } else {
      // A heading that names an item belongs to the other layout.
      role = items[i] ? "ignore" : (field ?? "ignore");
      // "Install year guess" with yes and no under it says which years are guesses.
      if (role !== "guess" && headingSaysGuess(heading) && isYesNoColumn(values(i))) return { role: "guess", rank: RANK.sure };
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
    keepOneColumnPerItem(heads, roles);
    return roles;
  }

  // A bare "Area" of numbers is square feet; one of words ("Basement") isn't read.
  if (!roles.includes("area")) {
    const at = heads.findIndex((h, i) => roles[i] === "ignore" && words(h) === "area" && isAreaColumn(values(i)));
    if (at >= 0) roles[at] = "area";
  }
  // Beside another quantity column and the building's name or year built, "Units",
  // "Unit count" or "# of units" is the building's unit count when its cells read as
  // one ("12", "12 units"). One that holds units of measure ("sf", "ea") is left out.
  if (!roles.includes("unitCount") && (roles.includes("building") || roles.includes("yearBuilt"))) {
    const saysUnits = (i: number) =>
      doubtfulQuantity(heads[i]) === "units" || (guesses[i].role === "quantity" && hasUnitWords(heads[i]));
    const other = guesses.findIndex((g, i) => g.role === "quantity" && !saysUnits(i));
    const at = heads.findIndex(
      (h, i) =>
        i !== other &&
        (roles[i] === "ignore" || roles[i] === "quantity") &&
        saysUnits(i) &&
        values(i).every((v) => readUnitCount(v).value !== null),
    );
    if (other >= 0 && at >= 0) {
      roles[at] = "unitCount";
      roles[other] = "quantity";
    }
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

/** A column that may or may not be the quantity, for the preview to ask about once. */
export interface QuantityDoubt {
  column: number;
  /**
   * "same": one number on every row, which may be the building's unit count.
   * "building": in a sheet of several buildings, one number on every row of each
   * building, which may be each building's unit count.
   * "numbers": numbers that may count items, or number the rows or apartments.
   */
  kind: "same" | "building" | "numbers";
  /** The number on every row, each building's first few, or the first few different ones. */
  values: string[];
}

// Words in a quantity heading that say it counts apartments: "# of units", "Unit count".
const UNIT_WORDS = new Set(["unit", "units", "apt", "apts", "apartment", "apartments", "door", "doors"]);

/** A heading that says it counts apartments: "# of units", "Unit count". */
function hasUnitWords(heading: string): boolean {
  return words(heading)
    .split(" ")
    .some((w) => UNIT_WORDS.has(w));
}

/**
 * In a sheet of several buildings, each building has one number on every one of its
 * rows, and they aren't all the same. A building's lone row counts only when the
 * heading says units, since one row says nothing about repeats.
 */
function sameInEachBuilding(groups: readonly (readonly string[])[], saysUnits: boolean): boolean {
  if (groups.length < 2) return false;
  const number = (v: string) => Number(v.replace(/,/g, ""));
  if (!groups.every((g) => g.every((v) => number(v) === number(g[0])))) return false;
  return saysUnits || groups.some((g) => g.length > 1);
}

/**
 * The column to ask about, if any, when no other column is the quantity:
 * - "#", "No." or "Units" holding numbers that don't simply run 1, 2, 3 (or 101,
 *   102, 103) down the sheet. They may be counts, or row or apartment numbers.
 * - A quantity column with the same number (not 1) on every row, when its heading
 *   says units ("# of units", "Unit count") or `buildingWide()` says a row is an
 *   item a building has one of, like a roof. It may be the building's unit count.
 * - The same, in a sheet of several buildings (`byBuilding`, from its Building
 *   column), for a number that's the same on every row of each building. It may be
 *   each building's unit count.
 * A column of 1s isn't asked about, since both answers give the same rows. Our own
 * format says which column is which, so it never asks.
 */
export function quantityQuestionColumn(
  heads: readonly string[],
  columns: readonly ColumnRole[],
  values: ColumnValues,
  buildingWide: () => boolean,
  byBuilding?: BuildingValues,
): QuantityDoubt | null {
  if (isCapexClockFormat(heads)) return null;
  const quantities = columns.flatMap((role, i) => (role === "quantity" ? [i] : []));
  if (quantities.length > 1) return null;
  const candidates =
    quantities.length === 1
      ? quantities
      : heads.flatMap((h, i) =>
          // A column the owner set to the building's unit count shows the question answered.
          (columns[i] === "ignore" || columns[i] === "unitCount") && (doubtfulQuantity(h) !== null || guessField(h) === "quantity")
            ? [i]
            : [],
        );
  for (const column of candidates) {
    const heading = heads[column] ?? "";
    const cells = values(column);
    if (cells.length === 0 || !cells.every((v) => PLAIN_NUMBER.test(v))) continue;
    const numbers = cells.map((v) => Number(v.replace(/,/g, "")));
    if (numbers.every((n) => n === 1)) continue;
    const same = cells.length > 1 && numbers.every((n) => n === numbers[0]);
    const groups = !same && byBuilding ? byBuilding(column) : [];
    const each = sameInEachBuilding(groups, hasUnitWords(heading));
    const sameDoubt: QuantityDoubt = { column, kind: "same", values: [cells[0]] };
    const eachDoubt: QuantityDoubt = { column, kind: "building", values: [...new Set(groups.map((g) => g[0]))].slice(0, 3) };
    if (doubtfulQuantity(heading) !== null) {
      if (isCounting(cells)) continue;
      if (same) return sameDoubt;
      return each ? eachDoubt : { column, kind: "numbers", values: [...new Set(cells)].slice(0, 3) };
    }
    if ((same || each) && (hasUnitWords(heading) || buildingWide())) return same ? sameDoubt : eachDoubt;
  }
  return null;
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
