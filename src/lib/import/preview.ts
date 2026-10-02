import { MAX_NOTES_LENGTH } from "@/components/calculator/draft";
import { formatUnitPrice } from "@/components/calculator/format";
import type { UnitLabel } from "@/lib/forecast";
import { defaultLife, type LibraryComponent } from "@/lib/library/components";
import type { ComponentCondition } from "@/lib/supabase/database.types";
import {
  columnValues,
  componentSlug,
  doubtfulYearColumns,
  headings,
  headingSaysSqFt,
  headingTiming,
  quantityQuestionColumn,
  sameItemColumns,
  type ColumnRole,
  type FieldKind,
  type Layout,
  type QuantityDoubt,
} from "./columns";
import { nameKey, type NameMatcher } from "./names";
import { cellText, clip, columnLetter, isBlankRow, listText, quote, type Cell, type Grid } from "./text";
import {
  readAge,
  readCondition,
  readInstallYear,
  readLife,
  readMoney,
  readQuantity,
  readRemaining,
  readReplaceBy,
  saysPerSqFt,
  type Reading,
} from "./values";

/** A row ready for the draft. Strings, like the form's own fields. */
export interface ImportedRow {
  librarySlug: string | null;
  category: string;
  name: string;
  quantity: string;
  unitLabel: UnitLabel;
  installYear: string;
  installYearIsGuess: boolean;
  usefulLife: string;
  costEach: string;
  condition: ComponentCondition | null;
  notes: string;
}

/** Fields the owner can fix in the preview. */
export type FixField = "name" | "quantity" | "installYear" | "usefulLife" | "costEach";

export type RowStatus = "ready" | "changed" | "needs_you";

export interface Issue {
  field: FixField;
  text: string;
}

export interface PreviewRow {
  /** Stable while the sheet and choices are the same: the first record's key. */
  id: string;
  /** Every record merged into this row, for fixes typed on it. */
  keys: string[];
  /** Sheet row numbers, counting from 1 as the sheet does. */
  sheetRows: number[];
  status: RowStatus;
  row: ImportedRow;
  /** What was changed to read it, e.g. "Read "approx 2014" as 2014, marked a guess". */
  changes: string[];
  issues: Issue[];
  /** The name question this row waits on, if it isn't answered yet. */
  question: string | null;
  /** The useful life is the library's typical one, not the sheet's. */
  lifeIsTypical: boolean;
}

export type SkipReason =
  | "above_headings"
  | "blank"
  | "repeated_headings"
  | "total"
  | "section"
  | "no_name"
  | "zero_quantity"
  | "nothing_listed";

export interface Skipped {
  sheetRow: number;
  reason: SkipReason;
}

/** A name that could be more than one library item. */
export interface NameQuestion {
  key: string;
  /** The name as the sheet first has it. */
  text: string;
  rows: number;
  suggestions: string[];
}

export interface Preview {
  rows: PreviewRow[];
  skipped: Skipped[];
  questions: NameQuestion[];
  /** Ages, years left or replace-by years are used, so the sheet's year matters. */
  usesSheetYear: boolean;
  /** The one-row-per-item layout has no column of item names yet. */
  missingItemColumn: boolean;
  /** No quantity column, so each row counts as one. */
  noQuantityColumn: boolean;
  /** With no quantity column, a total and a cost each give each row's quantity. */
  quantityFromTotals: boolean;
  /**
   * A column that may or may not be the quantity ("#", "No.", "Units", or one number
   * on every row): is it how many of each item, or something else, so each row
   * counts as one? Null for the answer until the owner says.
   */
  quantityQuestion: QuantityQuestion | null;
  /** No column gives install years (or ages, years left or replace-by years), so each row uses the year built. */
  noYearColumn: boolean;
  /** Year columns whose headings could mean something else, like "Date" or "Replacement year". */
  doubtfulYears: { column: number; heading: string; role: "installYear" | "replaceBy" }[];
  /**
   * Each column is a component: columns left out because another column (`kept`)
   * already gives that item for each apartment, like "Water heater age" beside
   * "Water heater installed".
   */
  sameItems: { column: number; heading: string; kept: number; name: string }[];
  /** Rows without a cost, which the forecast leaves out until one is added. */
  withoutCost: number;
  counts: { rows: number; ready: number; changed: number; needsYou: number; skipped: number };
}

export interface QuantityQuestion extends QuantityDoubt {
  heading: string;
  /** "each_one": it's the unit count or row numbers, so each row counts as one. */
  answer: "quantity" | "each_one" | null;
}

/** The answer that keeps a name as the owner's own item. */
export const KEEP_OWN = "__own__";

export interface ImportChoices {
  layout: Layout;
  columns: readonly ColumnRole[];
  /** The year the sheet was last updated; null while what's typed isn't a year. */
  sheetYear: number | null;
  /** Answers to name questions, by question key: a library slug or KEEP_OWN. */
  answers: Readonly<Record<string, string>>;
  /** What the owner typed to fix a record, by record key. */
  fixes: Readonly<Record<string, Partial<Record<FixField, string>>>>;
  /**
   * The owner answered the quantity question. The answer is the column's role:
   * Quantity, or Ignore for "each row counts as one".
   */
  quantityAnswered: boolean;
}

export interface Sheet {
  grid: Grid;
  headerRow: number;
}

// "Total", "Total CapEx", "Subtotal - interiors", "Grand total:", "Annual total", "Sum".
const TOTAL_START = /^(?:grand\s+|sub\s*-?\s*)?totals?\b/i;
const TOTAL_END = /\b(?:sub-?)?totals?\s*:?$/i;
const SUM = /^sum(?:\s*$|\s*[:(\-–—]|\s+(?:of|total)\b)/i;

/** A label that says its row adds up the others. */
export function isTotalLabel(text: string): boolean {
  const t = text.trim();
  return TOTAL_START.test(t) || TOTAL_END.test(t) || SUM.test(t);
}

// A cell that's only a number or an amount, like "4", "$48,000" or "1.4k".
const NUMBER_ONLY = /^[\d$.,\s%()-]+k?$/i;

/** A total row: its label, or the first words in it, say total or sum. */
function isTotalRow(row: readonly Cell[], itemText: string): boolean {
  if (isTotalLabel(itemText)) return true;
  const texts = row.map(cellText).filter((t) => t !== "");
  const label = texts.find((t) => !NUMBER_ONLY.test(t));
  return (texts[0] !== undefined && isTotalLabel(texts[0])) || (label !== undefined && isTotalLabel(label));
}

const SECTION_NAMES = new Set(
  "roofing hvac mechanical plumbing appliances flooring interior interiors exterior exteriors site electrical safety other systems".split(" "),
);
const ABSENT = /^(?:no|n|none|n\/a|na|not present|-+|–|—|0)$/i;
const PRESENT = /^(?:yes|y|x|✓|✔|present|have|has|yes - unknown)$/i;

const NO_QUANTITY = "No quantity, so counted as 1";
const COUNTED_EACH = "Kept the quantity as a count, not sq ft, so the cost is for each one";
const COUNTED_APARTMENTS = "Counted apartments, not sq ft, so the cost is for each apartment";

/** Cuts a value read from a number to a plain string: 1400, 0.25, never 1.4e+3. */
function numberText(value: number): string {
  return String(Math.round(value * 1e6) / 1e6);
}

function money(value: number): string {
  return formatUnitPrice(value);
}

/** One record before merging: an item from a row, or one cell of a row in the column layout. */
interface Record_ {
  key: string;
  sheetRow: number;
  location: string;
  row: ImportedRow;
  changes: string[];
  issues: Issue[];
  /** The name question this record's name raises, answered or not. */
  asked: Omit<NameQuestion, "rows"> | null;
  /** The question isn't answered yet. */
  pending: boolean;
  lifeIsTypical: boolean;
  /** Lines for the notes: the sheet's notes, words left over from a name or condition. */
  details: string[];
  /** The quantity, when it's a number, so merged rows can add up. */
  quantity: number | null;
  /**
   * The row's quantity was guessed and the owner should say: it waits on the quantity
   * question, or its cost is per sq ft with no square feet. The issue is added when
   * rows are merged, so it can say the quantity the merged row is added with.
   */
  quantityWaits: "question" | "sq_ft" | null;
}

interface Context {
  library: Map<string, LibraryComponent>;
  match: NameMatcher;
  choices: ImportChoices;
  currentYear: number;
  /** The column of a quantity question the owner hasn't answered, so rows it changes wait. */
  quantityPending: number | null;
  /** The quantity or cost column's heading says square feet, like "Qty (sq ft)" or "Cost/SF". */
  quantityInSqFt: boolean;
  costInSqFt: boolean;
}

/** The first column with this role that has something in this row (or the first with the role). */
function cellFor(row: readonly Cell[], columns: readonly ColumnRole[], role: FieldKind): Cell {
  let first: Cell = undefined;
  let found = false;
  columns.forEach((r, i) => {
    if (r !== role) return;
    if (!found) first = row[i];
    found = true;
    if (cellText(first) === "" && cellText(row[i]) !== "") first = row[i];
  });
  return first;
}

function hasRole(columns: readonly ColumnRole[], role: FieldKind): boolean {
  return columns.includes(role);
}

function isRepeatedHeadings(row: readonly Cell[], heads: readonly string[]): boolean {
  const named = heads.filter((h) => h !== "");
  const same = heads.filter((h, i) => h !== "" && cellText(row[i]).toLowerCase() === h.toLowerCase()).length;
  return same >= Math.min(2, named.length) && same > 0;
}

/** Applies a typed fix, read with the same rules as the sheet. */
function fixed(ctx: Context, key: string, field: FixField): string | undefined {
  const text = ctx.choices.fixes[key]?.[field];
  return text !== undefined && text.trim() !== "" ? text.trim() : undefined;
}

/** Library match, the owner's answer, or their own item. */
function resolveName(
  ctx: Context,
  original: string,
  record: Pick<Record_, "changes" | "details" | "asked" | "pending">,
): { slug: string | null; name: string } {
  const found = ctx.match(original);
  let slug: string | null = null;
  if (found.kind === "exact" || found.kind === "matched") slug = found.slug;
  if (found.kind === "unsure") {
    const key = nameKey(original);
    const answer = ctx.choices.answers[key];
    record.asked = { key, text: original, suggestions: found.suggestions };
    if (answer !== undefined && answer !== KEEP_OWN && ctx.library.has(answer)) slug = answer;
    // Not applied until the owner answers.
    record.pending = answer === undefined;
  }
  const item = slug ? ctx.library.get(slug) : undefined;
  if (!item) return { slug: null, name: clip(original, 200) };
  if (found.kind !== "exact") {
    record.changes.push(`Matched ${quote(original)} to ${item.name}`);
    // Words beyond the item's name (a brand, a size) are kept in the notes.
    if (found.kind !== "none" && found.extraWords) record.details.push(original);
  }
  return { slug, name: item.name };
}

/** Install year from whichever column has one, in this order: install year, age, replace by, years left. */
function readTiming(
  ctx: Context,
  key: string,
  cells: { installYear: Cell; age: Cell; replaceBy: Cell; remaining: Cell },
  life: number | null,
): { reading: Reading<number>; raw: string } {
  const { sheetYear } = ctx.choices;
  const fix = fixed(ctx, key, "installYear");
  if (fix !== undefined) return { reading: readInstallYear(fix, ctx.currentYear), raw: fix };
  const text = (cell: Cell) => cellText(cell);
  // "unknown" in the install year column gives way to an age or years left in the same row.
  let unknown: { reading: Reading<number>; raw: string } | null = null;
  if (text(cells.installYear) !== "") {
    const reading = readInstallYear(cells.installYear, ctx.currentYear);
    const result = { reading, raw: text(cells.installYear) };
    if (reading.value !== null || reading.problem) return result;
    unknown = result;
  }
  const derived: [Cell, string, (year: number) => Reading<number>][] = [
    [cells.age, `age ${text(cells.age)}`, (y) => readAge(cells.age, y, ctx.currentYear)],
    [cells.replaceBy, `replace by ${text(cells.replaceBy)}`, (y) => readReplaceBy(cells.replaceBy, y, life, ctx.currentYear)],
    [cells.remaining, `${text(cells.remaining)} left`, (y) => readRemaining(cells.remaining, y, life, ctx.currentYear)],
  ];
  for (const [cell, raw, read] of derived) {
    if (text(cell) === "") continue;
    if (sheetYear === null) {
      return { reading: { value: null, problem: "Fix the year this sheet was last updated, above." }, raw };
    }
    const reading = read(sheetYear);
    // Another "unknown" here: the install year's note says what happens.
    if (unknown && reading.value === null && !reading.problem) continue;
    return { reading, raw };
  }
  return unknown ?? { reading: { value: null }, raw: "" };
}

/** Records from one row of a one-row-per-item sheet. */
function rowRecord(ctx: Context, row: readonly Cell[], index: number, section: string | null): Record_ | SkipReason {
  const { columns } = ctx.choices;
  const key = `r${index}`;
  const cell = (role: FieldKind) => cellFor(row, columns, role);
  const original = fixed(ctx, key, "name") ?? cellText(cell("item"));
  const record: Record_ = {
    key,
    sheetRow: index + 1,
    location: cellText(cell("location")),
    row: {
      librarySlug: null,
      category: "Other",
      name: "",
      quantity: "1",
      unitLabel: "per_building",
      installYear: "",
      installYearIsGuess: false,
      usefulLife: "",
      costEach: "",
      condition: null,
      notes: "",
    },
    changes: [],
    issues: [],
    asked: null,
    pending: false,
    lifeIsTypical: false,
    details: [],
    quantity: 1,
    quantityWaits: null,
  };

  if (isTotalRow(row, cellText(cell("item")))) return "total";
  const valueRoles: FieldKind[] = ["quantity", "installYear", "age", "life", "remaining", "replaceBy", "cost", "total"];
  const hasValues = valueRoles.some((r) => cellText(cell(r)) !== "");
  if (original === "") {
    if (!hasValues) return "no_name";
    // Amounts with no name and nothing else, like a SUM at the foot of the cost column.
    const onlyAmounts = row.every((c, i) => cellText(c) === "" || columns[i] === "cost" || columns[i] === "total");
    if (onlyAmounts) return "total";
    record.issues.push({ field: "name", text: "This row has no item name. Type one." });
  } else if (!hasValues && cellText(cell("notes")) === "" && cellText(cell("condition")) === "") {
    const plain = original.replace(/:$/, "").toLowerCase();
    if (original.endsWith(":") || SECTION_NAMES.has(plain)) return "section";
  }

  // Quantity, kept as given.
  const quantityFix = fixed(ctx, key, "quantity");
  const quantityCell = quantityFix ?? cell("quantity");
  let squareFeet = false;
  // The sheet or a fix gave a number, so a total can't change it.
  let quantityGiven = false;
  if (quantityFix !== undefined || hasRole(columns, "quantity")) {
    const q = readQuantity(quantityCell);
    squareFeet = q.squareFeet === true || ctx.quantityInSqFt;
    if (q.problem) {
      record.issues.push({ field: "quantity", text: q.problem });
      record.row.quantity = cellText(quantityCell);
      record.quantity = null;
    } else if (q.value === 0) {
      return "zero_quantity";
    } else if (q.value === null) {
      record.changes.push(NO_QUANTITY);
    } else {
      record.quantity = q.value;
      record.row.quantity = numberText(q.value);
      quantityGiven = true;
    }
  }

  // Name, matched to the library when it's sure.
  if (original !== "") {
    const { slug, name } = resolveName(ctx, original, record);
    record.row.name = name;
    const item = slug ? ctx.library.get(slug) : undefined;
    if (item) {
      record.row.librarySlug = item.slug;
      record.row.category = item.category;
      record.row.unitLabel = item.unitLabel;
    } else {
      const category = clip(cellText(cell("category")), 100);
      record.row.category = category || section || "Other";
    }
  }
  // Square feet, in the quantity or the cost, are counted per sq ft. Anything else is
  // a count priced each, even for an item the library counts in square feet.
  const costFix = fixed(ctx, key, "costEach");
  const costCell = costFix ?? cell("cost");
  const costPerSqFt = saysPerSqFt(costCell) || ctx.costInSqFt;
  if (squareFeet || costPerSqFt) {
    if (squareFeet && record.row.librarySlug && record.row.unitLabel !== "per_sq_ft") {
      record.changes.push("Counted in square feet, as the sheet does");
    }
    if (!squareFeet && quantityGiven) record.changes.push("Read the quantity as square feet, since the cost is per sq ft");
    record.row.unitLabel = "per_sq_ft";
  } else if (record.row.unitLabel === "per_sq_ft") {
    record.row.unitLabel = "per_building";
    record.changes.push(COUNTED_EACH);
  }

  // Useful life: the sheet's, else the library's typical one.
  const lifeFix = fixed(ctx, key, "usefulLife");
  const lifeCell = lifeFix ?? cell("life");
  const lifeReading = readLife(lifeCell);
  let life: number | null = lifeReading.value;
  if (lifeReading.problem) {
    record.issues.push({ field: "usefulLife", text: lifeReading.problem });
    record.row.usefulLife = cellText(lifeCell);
  } else if (life !== null) {
    record.row.usefulLife = String(life);
    if (lifeReading.note) record.changes.push(lifeReading.note);
  } else {
    const item = record.row.librarySlug ? ctx.library.get(record.row.librarySlug) : undefined;
    if (item) {
      life = defaultLife(item);
      record.row.usefulLife = String(life);
      record.lifeIsTypical = true;
    }
  }

  const timing = { installYear: cell("installYear"), age: cell("age"), replaceBy: cell("replaceBy"), remaining: cell("remaining") };
  applyTiming(record, readTiming(ctx, key, timing, life));

  // Cost each, or a total divided by the quantity.
  const totalCell = cell("total");
  let fromTotal = false;
  if (costFix !== undefined || cellText(costCell) !== "") {
    const c = readMoney(costCell);
    if (c.problem) {
      record.issues.push({ field: "costEach", text: c.problem });
      record.row.costEach = cellText(costCell);
    } else {
      if (c.value !== null) record.row.costEach = numberText(c.value);
      if (c.note) record.changes.push(c.note);
      const t = cellText(totalCell) !== "" ? readMoney(totalCell) : null;
      if (c.value !== null && !c.range && t?.value != null && !t.problem) {
        fromTotal = checkTotal(record, c.value, t.value, quantityGiven);
      }
    }
  } else if (cellText(totalCell) !== "") {
    const t = readMoney(totalCell);
    if (t.problem) {
      record.issues.push({ field: "costEach", text: t.problem.replace("a cost", "a total cost") });
      record.row.costEach = `total ${cellText(totalCell)}`;
    } else if (t.value !== null) {
      if (record.quantity === null) {
        record.issues.push({ field: "costEach", text: "Fix the quantity to work out the cost each from the total, or type the cost each." });
        record.row.costEach = `total ${cellText(totalCell)}`;
      } else {
        const each = Math.round((t.value / record.quantity) * 100) / 100;
        record.row.costEach = numberText(each);
        record.changes.push(
          record.quantity === 1
            ? `Used the total, ${money(t.value)}, as the cost`
            : `Divided the ${money(t.value)} total by ${record.quantity}: ${money(each)} each`,
        );
      }
    } else if (t.note) {
      record.changes.push(t.note.replace("the cost", "the total"));
    }
  }

  if (!quantityGiven && record.quantity === 1 && costPerSqFt) {
    // Nothing gave the square feet, so the row counts as 1 sq ft.
    record.quantityWaits = "sq_ft";
  } else if (ctx.quantityPending !== null && quantityFix === undefined && !fromTotal) {
    // The answer changes this row only if the column says something other than 1.
    const asked = readQuantity(row[ctx.quantityPending]).value;
    if (asked !== null && asked !== 1) record.quantityWaits = "question";
  }

  const condition = readCondition(cell("condition"));
  record.row.condition = condition.value;
  if (condition.note) record.changes.push(condition.note);
  if (condition.keep) record.details.push(`Condition: ${condition.keep}`);

  for (const [i, role] of columns.entries()) {
    const text = role === "notes" ? cellText(row[i]) : "";
    if (text !== "") record.details.push(text);
  }
  return record;
}

/** Two amounts agree, give or take rounding. */
function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.01);
}

/**
 * Checks a row's total against its quantity and cost each. With no quantity on the
 * sheet, the total says how many there are; a total that disagrees with a quantity
 * the sheet does give needs the owner. True when the quantity came from the total.
 */
function checkTotal(record: Record_, each: number, total: number, quantityGiven: boolean): boolean {
  const quantity = record.quantity;
  if (quantity === null) return false;
  if (sameAmount(quantity * each, total)) return false;
  if (!quantityGiven && each > 0) {
    const worked = total / each;
    const whole = Math.round(worked);
    if (whole >= 1 && sameAmount(whole * each, total)) {
      record.quantity = whole;
      record.row.quantity = numberText(whole);
      const i = record.changes.indexOf(NO_QUANTITY);
      if (i >= 0) record.changes.splice(i, 1);
      record.changes.push(`Worked out the quantity, ${whole}, from the ${money(total)} total at ${money(each)} each`);
      return true;
    }
  }
  const sum = `${quantity.toLocaleString("en-US")} × ${money(each)}`;
  record.issues.push(
    {
      field: "quantity",
      text: `The sheet's total, ${money(total)}, isn't ${sum}. Fix the quantity or the cost each, or ignore the Total column. If you don't, the total isn't used.`,
    },
    { field: "costEach", text: `Leave this blank to keep ${money(each)}.` },
  );
  return false;
}

/** Puts an install year reading into a record. Unsolved ones keep what the sheet says, so the form flags it. */
function applyTiming(record: Record_, { reading, raw }: { reading: Reading<number>; raw: string }) {
  if (reading.problem) {
    record.issues.push({ field: reading.needsLife ? "usefulLife" : "installYear", text: reading.problem });
    record.row.installYear = raw;
    return;
  }
  if (reading.value !== null) record.row.installYear = String(reading.value);
  record.row.installYearIsGuess = reading.guess === true;
  if (reading.note) record.changes.push(reading.note);
}

/** Records from one apartment's row when each column is a component. */
function columnRecords(ctx: Context, row: readonly Cell[], index: number, heads: readonly string[]): Record_[] {
  const { columns } = ctx.choices;
  const location = cellText(cellFor(row, columns, "location"));
  const records: Record_[] = [];
  columns.forEach((role, c) => {
    const slug = componentSlug(role);
    const item = slug ? ctx.library.get(slug) : undefined;
    const text = cellText(row[c]);
    if (!item || text === "" || ABSENT.test(text)) return;
    const key = `r${index}c${c}`;
    const life = defaultLife(item);
    // Each cell is one apartment's, so the quantity counts apartments, never square feet.
    const sqFt = item.unitLabel === "per_sq_ft";
    const record: Record_ = {
      key,
      sheetRow: index + 1,
      location,
      row: {
        librarySlug: item.slug,
        category: item.category,
        name: item.name,
        quantity: "1",
        unitLabel: sqFt ? "per_unit" : item.unitLabel,
        installYear: "",
        installYearIsGuess: false,
        usefulLife: String(life),
        costEach: "",
        condition: null,
        notes: "",
      },
      changes: sqFt ? [COUNTED_APARTMENTS] : [],
      issues: [],
      asked: null,
      pending: false,
      lifeIsTypical: true,
      details: [],
      quantity: 1,
      quantityWaits: null,
    };
    const fix = fixed(ctx, key, "installYear");
    if (fix === undefined && PRESENT.test(text)) {
      record.changes.push(`Read ${quote(text)} as having one with no install year, so it uses the year built, marked an estimate`);
    } else if (fix === undefined && headingTiming(heads[c]) === "age") {
      applyTiming(record, readTiming(ctx, key, { installYear: "", age: row[c], replaceBy: "", remaining: "" }, life));
    } else {
      applyTiming(record, readTiming(ctx, key, { installYear: fix ?? row[c], age: "", replaceBy: "", remaining: "" }, life));
    }
    records.push(record);
  });
  return records;
}

/** "Apt: 101, 102 and 205", cut to "…and 12 more" so it fits in `max` characters. */
export function locationLine(label: string, locations: readonly string[], max: number): string {
  const full = `${label}: ${listText(locations)}`;
  if (full.length <= max) return full;
  for (let shown = locations.length - 1; shown >= 1; shown--) {
    const line = `${label}: ${locations.slice(0, shown).join(", ")} …and ${locations.length - shown} more`;
    if (line.length <= max) return line;
  }
  return clip(`${label}: …${locations.length} in all`, max);
}

/**
 * Notes for a row made from one or more records: where they are, then each one's
 * own notes, all within the notes limit.
 */
export function mergedNotes(label: string, members: readonly { location: string; details: string[] }[]): string {
  const locations = [...new Set(members.map((m) => m.location).filter(Boolean))];
  const lines: string[] = [];
  const merged = members.length > 1;
  for (const m of members) {
    if (m.details.length === 0) continue;
    const text = m.details.join("; ");
    const line = merged && m.location ? `${m.location}: ${text}` : text;
    if (!lines.includes(line)) lines.push(line);
  }
  // Counted in UTF-16 units, as the notes box counts them, which is never fewer than the database's count.
  const out = locations.length > 0 ? [locationLine(label, locations, MAX_NOTES_LENGTH)] : [];
  let used = out[0]?.length ?? 0;
  for (const [i, line] of lines.entries()) {
    const room = MAX_NOTES_LENGTH - used - (out.length > 0 ? 1 : 0);
    const after = lines.length - i - 1;
    // Leaves room to say how many notes didn't fit, if any come after this one.
    const tail = after > 0 ? `\n…and ${after} more ${after === 1 ? "note" : "notes"}` : "";
    let text = line;
    if (line.length + tail.length > room) {
      const left = after + 1;
      const more = `…and ${left} more ${left === 1 ? "note" : "notes"}`;
      // The last note is cut to fit rather than left out.
      if (after === 0 && room >= 20) text = clip(line, room);
      else if (more.length <= room) text = more;
      else break;
      out.push(text);
      break;
    }
    out.push(text);
    used += text.length + (out.length > 1 ? 1 : 0);
  }
  return out.join("\n");
}

function mergeKey(r: Record_): string {
  const { row } = r;
  return JSON.stringify([
    row.librarySlug ?? `own:${row.name.trim().toLowerCase()}`,
    row.category,
    row.unitLabel,
    row.installYear,
    row.installYearIsGuess,
    row.usefulLife,
    row.costEach,
    row.condition,
    r.pending ? r.asked?.key : null,
    r.quantity === null ? row.quantity : "",
    // A row with no name stays on its own, for the owner to name.
    row.name === "" ? r.key : "",
  ]);
}

/** What a row whose quantity waits on the owner says, with the quantity it's added with. */
function waitingText(waits: "question" | "sq_ft", quantity: string, questionColumn: number | null): string {
  const n = Number(quantity);
  const shown = Number.isFinite(n) ? n.toLocaleString("en-US") : quantity;
  return waits === "sq_ft"
    ? `The cost is per sq ft. Type the square feet. If you don't, it's added as ${shown} sq ft.`
    : `Answer the question about column ${columnLetter(questionColumn ?? 0)} above, or type the quantity. If you don't, it's added as ${shown}.`;
}

/** Merges identical records into one row with a quantity. */
function merge(records: Record_[], locationLabel: string, questionColumn: number | null): PreviewRow[] {
  const groups = new Map<string, Record_[]>();
  for (const r of records) {
    const key = mergeKey(r);
    const group = groups.get(key);
    if (group) group.push(r);
    else groups.set(key, [r]);
  }
  return [...groups.values()].map((group) => {
    const first = group[0];
    const changes = [...new Set(group.flatMap((r) => r.changes))];
    const issues = group.flatMap((r) => r.issues).filter((issue, i, all) => all.findIndex((o) => o.field === issue.field && o.text === issue.text) === i);
    let quantity = first.row.quantity;
    if (group.length > 1) {
      if (group.every((r) => r.quantity !== null)) {
        quantity = numberText(group.reduce((sum, r) => sum + (r.quantity ?? 0), 0));
      }
      changes.unshift(`Combined ${group.length} identical rows`);
    }
    for (const waits of ["sq_ft", "question"] as const) {
      if (group.some((r) => r.quantityWaits === waits)) {
        issues.push({ field: "quantity", text: waitingText(waits, quantity, questionColumn) });
      }
    }
    const question = first.pending && first.asked ? first.asked : null;
    if (question) {
      issues.unshift({ field: "name", text: `Which item is ${quote(question.text)}? Answer above, or it's added as its own item.` });
    }
    const status: RowStatus = issues.length > 0 ? "needs_you" : changes.length > 0 ? "changed" : "ready";
    const notes = mergedNotes(locationLabel, group);
    return {
      id: first.key,
      keys: group.map((r) => r.key),
      sheetRows: [...new Set(group.map((r) => r.sheetRow))],
      status,
      row: { ...first.row, quantity, notes },
      changes,
      issues,
      question: question?.key ?? null,
      lifeIsTypical: first.lifeIsTypical,
    };
  });
}

/** A row names a library item a building has one of, like a roof or a boiler. */
function namesBuildingWideItem(
  { grid, headerRow }: Sheet,
  columns: readonly ColumnRole[],
  library: ReadonlyMap<string, LibraryComponent>,
  match: NameMatcher,
): boolean {
  const itemColumn = columns.indexOf("item");
  if (itemColumn < 0) return false;
  for (let i = headerRow + 1; i < grid.length; i++) {
    const text = cellText(grid[i]?.[itemColumn]);
    if (text === "") continue;
    const found = match(text);
    if ((found.kind === "exact" || found.kind === "matched") && library.get(found.slug)?.unitLabel === "per_building") return true;
  }
  return false;
}

/** The last row with anything in it; blank rows after it aren't listed. */
function lastFilledRow(grid: Grid): number {
  for (let i = grid.length - 1; i >= 0; i--) if (!isBlankRow(grid[i])) return i;
  return -1;
}

/** Data rows under the headings, for the row limit. */
export function dataRowCount(grid: Grid, headerRow: number): number {
  return Math.max(0, lastFilledRow(grid) - headerRow);
}

/**
 * Reads the sheet with the owner's choices into preview rows: Ready, Changed or
 * Needs you, with skipped rows listed. Nothing is added until the owner says so.
 */
export function buildPreview(
  sheet: Sheet,
  choices: ImportChoices,
  library: readonly LibraryComponent[],
  match: NameMatcher,
  currentYear: number,
): Preview {
  const { grid, headerRow } = sheet;
  const heads = headings(grid, headerRow);
  const { columns, layout } = choices;
  const libraryBySlug = new Map(library.map((c) => [c.slug, c]));
  const doubt =
    layout === "rows"
      ? quantityQuestionColumn(heads, columns, columnValues(grid, headerRow), () =>
          namesBuildingWideItem(sheet, columns, libraryBySlug, match),
        )
      : null;
  const quantityAnswer = !doubt || !choices.quantityAnswered ? null : columns[doubt.column] === "quantity" ? "quantity" : "each_one";
  const ctx: Context = {
    library: libraryBySlug,
    match,
    choices,
    currentYear,
    quantityPending: doubt && quantityAnswer === null ? doubt.column : null,
    quantityInSqFt: headingSaysSqFt(heads[columns.indexOf("quantity")] ?? ""),
    costInSqFt: headingSaysSqFt(heads[columns.indexOf("cost")] ?? ""),
  };
  const skipped: Skipped[] = [];
  const records: Record_[] = [];
  for (let i = 0; i < headerRow; i++) if (!isBlankRow(grid[i])) skipped.push({ sheetRow: i + 1, reason: "above_headings" });

  let section: string | null = null;
  const last = lastFilledRow(grid);
  for (let i = headerRow + 1; i <= last; i++) {
    const row = grid[i] ?? [];
    const skip = (reason: SkipReason) => skipped.push({ sheetRow: i + 1, reason });
    if (isBlankRow(row)) {
      skip("blank");
      continue;
    }
    if (isRepeatedHeadings(row, heads)) {
      skip("repeated_headings");
      continue;
    }
    if (layout === "columns") {
      if (isTotalRow(row, cellText(cellFor(row, columns, "location")))) {
        skip("total");
        continue;
      }
      const found = columnRecords(ctx, row, i, heads);
      if (found.length === 0) skip("nothing_listed");
      records.push(...found);
      continue;
    }
    const result = rowRecord(ctx, row, i, section);
    if (typeof result === "string") {
      skip(result);
      if (result === "section") {
        const name = cellText(cellFor(row, columns, "item")).replace(/:$/, "");
        const category = library.find((c) => c.category.toLowerCase() === name.toLowerCase())?.category;
        section = category ?? null;
      }
      continue;
    }
    records.push(result);
  }

  const locationColumn = columns.indexOf("location");
  const label = locationColumn >= 0 ? clip(heads[locationColumn].replace(/[:#]+\s*$/, "").trim(), 30) || "Location" : "Location";
  const rows = merge(records, label, ctx.quantityPending);

  const questions = new Map<string, NameQuestion>();
  for (const r of records) {
    const q = r.asked;
    if (!q) continue;
    const existing = questions.get(q.key);
    if (existing) existing.rows += 1;
    else questions.set(q.key, { key: q.key, text: q.text, rows: 1, suggestions: q.suggestions });
  }

  const used = new Set<ColumnRole>(columns);
  const usesSheetYear =
    layout === "columns"
      ? columns.some((role, c) => componentSlug(role) !== null && headingTiming(heads[c]) === "age")
      : used.has("age") || used.has("remaining") || used.has("replaceBy");
  const count = (status: RowStatus) => rows.filter((r) => r.status === status).length;
  return {
    rows,
    skipped,
    questions: [...questions.values()],
    usesSheetYear,
    missingItemColumn: layout === "rows" && !used.has("item"),
    noQuantityColumn: layout === "rows" && !used.has("quantity"),
    quantityFromTotals: layout === "rows" && !used.has("quantity") && used.has("total") && used.has("cost"),
    quantityQuestion: doubt && { ...doubt, heading: heads[doubt.column], answer: quantityAnswer },
    noYearColumn: layout === "rows" && !(["installYear", "age", "remaining", "replaceBy"] as const).some((r) => used.has(r)),
    doubtfulYears: layout === "rows" ? doubtfulYearColumns(heads, columns) : [],
    sameItems:
      layout === "columns"
        ? sameItemColumns(heads, columns, match).map(({ column, kept, slug }) => ({
            column,
            heading: heads[column],
            kept,
            name: libraryBySlug.get(slug)?.name ?? slug,
          }))
        : [],
    withoutCost: rows.filter((r) => r.row.costEach === "").length,
    counts: {
      rows: rows.length,
      ready: count("ready"),
      changed: count("changed"),
      needsYou: count("needs_you"),
      skipped: skipped.length,
    },
  };
}
