import { formatUnitPrice } from "@/components/calculator/format";
import type { ComponentCondition } from "@/lib/supabase/database.types";
import type { UnitLabel } from "@/verticals/landlord";
import { cellText, isDate, quote, type Cell } from "./text";

/**
 * What one cell gave: a value, or null for a blank. `note` says what was done to
 * read it (shown as Changed), `guess` marks an estimate, and `problem` says why the
 * owner needs to look (shown as Needs you, and the value is null).
 */
export interface Reading<T> {
  value: T | null;
  note?: string;
  guess?: boolean;
  problem?: string;
  /** The problem is a missing useful life, which an install year is worked out from. */
  needsLife?: boolean;
}

/** Earliest install year the calculator accepts. */
export const EARLIEST_YEAR = 1900;
// Matches the save limits in src/lib/properties/convert.ts.
const MAX_QUANTITY = 1e9;
const MAX_COST = 1e12;

// Cells that say nobody knows: the install year is left blank (year built stands in).
const UNKNOWN =
  /^(?:orig(?:inal)?(?: (?:to|with) (?:the )?(?:building|bldg|property|house))?|original install|unknown|unk|not sure|unsure|don'?t know|dk|n\/?a|none|tbd|tbc|\?+|[-–—]+|same as (?:the )?(?:building|bldg)|builder|from build)\.?$/i;

// Words that make a value an estimate: "approx 2014", "~8", "c. 2014", "2014?".
const GUESS_WORDS =
  /(?:^|\s|\()(?:approx(?:imately)?|apx|appx|about|around|circa|ca|c|est(?:imated?)?|maybe|probably|prob|roughly|guess|or so|\+\/-)(?:\.|\)|\s|$)/gi;

function withoutGuessWords(text: string): { rest: string; guess: boolean } {
  let rest = text.replace(GUESS_WORDS, " ");
  let guess = rest !== text;
  if (/[~≈]/.test(rest)) {
    rest = rest.replace(/[~≈]/g, " ");
    guess = true;
  }
  if (/\?\s*$/.test(rest)) {
    rest = rest.replace(/\?+\s*$/, "");
    guess = true;
  }
  if (/\d\s*-?ish\b/i.test(rest)) {
    rest = rest.replace(/(\d)\s*-?ish\b/gi, "$1");
    guess = true;
  }
  return { rest: rest.replace(/\(\s*\)/g, " ").replace(/\s+/g, " ").trim(), guess };
}

const MONTH = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
// What's left of a date once its year is taken out: days, months, seasons, a time.
const DATE_PART = new RegExp(
  `^(?:t?\\d{1,3}(?:st|nd|rd|th|z)?|${MONTH}|spring|summer|fall|autumn|winter|early|mid|late|q[1-4]|of|in|am|pm)$`,
  "i",
);
const TWO_DIGIT_YEAR = new RegExp(`^(?:'?\\d{1,2}|(?:${MONTH})[\\s\\-/.']*\\d{1,2}|\\d{1,2}[\\-/.]\\d{1,2}(?:[\\-/.]\\d{1,2})?)$`, "i");

function isOnlyDateParts(text: string): boolean {
  return text
    .split(/[\s/\-.,:]+|(?=t\d)/i)
    .filter(Boolean)
    .every((part) => DATE_PART.test(part));
}

/** The year a cell names: "2014", "6/12/2014", "June 2014", an Excel date. */
interface FoundYear {
  year: number | null;
  guess: boolean;
  /** Words besides the date, e.g. "replaced 2014". */
  extraWords: boolean;
  unknown: boolean;
  problem?: string;
}

// "1990s", "the '90s", "early 2000s", "mid-80s": a decade, read as a guess.
const DECADE = /(?:\b(early|mid|late)[\s-]*)?(?:the\s+)?(?:\b((?:1[89]|2\d)\d0)|'?\b([3-9]0))'?s\b/i;
// How far into a decade early, mid and late are, at the older end of each.
const DECADE_PART: Record<string, number> = { early: 0, mid: 4, late: 7 };
// "pre-2000", "before 2000", "2000 or earlier", "2015+": a limit, not a year.
const LIMIT =
  /^(?:(?:pre|before|prior to|older than|earlier than|post|after|newer than|later than)(?:\s|-|$)|[<>≤≥])|\bor\s+(?:earlier|before|older|prior|later|after|newer)\b|\d\s*\+$/i;

function findYear(cell: Cell): FoundYear {
  // Excel dates are read as midnight UTC, so the UTC year is the one the sheet shows.
  if (isDate(cell)) return { year: cell.getUTCFullYear(), guess: false, extraWords: false, unknown: false };
  if (typeof cell === "number" && Number.isInteger(cell) && cell >= 1000 && cell <= 2999) {
    return { year: cell, guess: false, extraWords: false, unknown: false };
  }
  const text = cellText(cell);
  if (text === "") return { year: null, guess: false, extraWords: false, unknown: false };
  if (UNKNOWN.test(text)) return { year: null, guess: false, extraWords: false, unknown: true };
  const { rest, guess } = withoutGuessWords(text);
  if (LIMIT.test(rest) && /\d/.test(rest)) {
    return {
      year: null,
      guess,
      extraWords: false,
      unknown: false,
      problem: `${quote(text)} doesn't give one year. Type your best guess, with "approx" in front to mark it a guess.`,
    };
  }
  const decade = rest.match(DECADE);
  if (decade) {
    const start = decade[2] ? Number(decade[2]) : 1900 + Number(decade[3]);
    const others = rest.replace(decade[0], " ");
    if (!/\d/.test(others)) {
      return { year: start + (DECADE_PART[decade[1]?.toLowerCase() ?? ""] ?? 0), guess: true, extraWords: false, unknown: false };
    }
  }
  const years = [...new Set([...rest.matchAll(/(?<!\d)(1[89]\d\d|2\d\d\d)(?!\d)/g)].map((m) => Number(m[1])))];
  if (years.length > 1) {
    return { year: null, guess, extraWords: false, unknown: false, problem: `${quote(text)} has more than one year. Type the one to use.` };
  }
  if (years.length === 1) {
    const others = rest.replace(String(years[0]), " ").replace(/\.0+\b/, " ");
    return { year: years[0], guess, extraWords: !isOnlyDateParts(others), unknown: false };
  }
  if (TWO_DIGIT_YEAR.test(rest)) {
    return { year: null, guess, extraWords: false, unknown: false, problem: `Couldn't tell which year ${quote(text)} means. Type the 4-digit year.` };
  }
  return { year: null, guess, extraWords: false, unknown: false, problem: `Couldn't read ${quote(text)} as a year.` };
}

/** An install year that has to be from 1900 to this year. */
function checkInstallYear(year: number, currentYear: number): string | undefined {
  if (year < EARLIEST_YEAR) return `${year} is before ${EARLIEST_YEAR}. Type the install year, or leave it blank to use the year built.`;
  if (year > currentYear) return `${year} hasn't happened yet. Type the year it was installed.`;
  return undefined;
}

/**
 * An install year: 2014, 6/12/2014 and Excel dates are read as they are, "approx 2014"
 * is a guess, "orig" and "unknown" leave it blank, and "Jun-14" or "14" need the owner.
 */
export function readInstallYear(cell: Cell, currentYear: number): Reading<number> {
  const text = cellText(cell);
  const found = findYear(cell);
  if (found.problem) return { value: null, problem: found.problem };
  if (found.unknown) {
    return { value: null, note: `Read ${quote(text)} as no install year, so it uses the year built, marked an estimate` };
  }
  if (found.year === null) return { value: null };
  const problem = checkInstallYear(found.year, currentYear);
  if (problem) return { value: null, problem };
  if (found.guess) return { value: found.year, guess: true, note: `Read ${quote(text)} as ${found.year}, marked a guess` };
  if (found.extraWords) return { value: found.year, note: `Read ${quote(text)} as ${found.year}` };
  return { value: found.year };
}

/** A count of years, like an age or the years left: "8", "8 yrs old", "approx 8", "6 months". */
interface FoundYears {
  value: number | null;
  /** Both ends of a range like "8–10". */
  range?: [number, number];
  guess: boolean;
  unknown: boolean;
  problem?: string;
}

const YEARS_WORDS = String.raw`(?:years?|yrs?\.?|y|yo|y\/o)?\s*(?:old|left|remaining|to go)?`;
const NUMBER = String.raw`(-?\d+(?:\.\d+)?)`;

function findYears(cell: Cell, what: string): FoundYears {
  if (typeof cell === "number") return { value: Number.isFinite(cell) ? cell : null, guess: false, unknown: false };
  const text = cellText(cell);
  if (text === "") return { value: null, guess: false, unknown: false };
  if (UNKNOWN.test(text)) return { value: null, guess: false, unknown: true };
  const { rest, guess: guessed } = withoutGuessWords(text);
  let guess = guessed;
  const lower = rest.toLowerCase();
  if (/^(?:(?:brand )?new|just (?:replaced|installed))$/.test(lower)) return { value: 0, guess: true, unknown: false };
  const months = lower.match(new RegExp(`^${NUMBER}\\s*(?:months?|mos?\\.?|mths?)(?: old)?$`));
  if (months) return { value: Number(months[1]) / 12, guess: true, unknown: false };
  const range = lower.match(new RegExp(`^${NUMBER}\\s*(?:-|–|—|to)\\s*${NUMBER}\\s*${YEARS_WORDS}$`));
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])];
    return { value: null, range: [Math.min(a, b), Math.max(a, b)], guess: true, unknown: false };
  }
  const single = lower.match(new RegExp(`^${NUMBER}\\s*(\\+)?\\s*${YEARS_WORDS}$`));
  if (single) {
    if (single[2]) guess = true;
    return { value: Number(single[1]), guess, unknown: false };
  }
  return { value: null, guess, unknown: false, problem: `Couldn't read ${quote(text)} as ${what}.` };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** "a 25-year life", "an 18-year life". */
function aLife(years: number): string {
  const an = years === 8 || years === 11 || years === 18 || (years >= 80 && years <= 89);
  return `${an ? "an" : "a"} ${years}-year life`;
}

/** Install year from an age on the sheet, counted back from the year the sheet was last updated. */
export function readAge(cell: Cell, sheetYear: number, currentYear: number): Reading<number> {
  const text = cellText(cell);
  // A year typed in the age column is an install year.
  const asYear = findYear(cell);
  if (asYear.year !== null && !asYear.extraWords && !asYear.problem && (typeof cell !== "number" || cell >= 1000)) {
    const problem = checkInstallYear(asYear.year, currentYear);
    if (problem) return { value: null, problem };
    return { value: asYear.year, guess: true, note: `Read ${quote(text)} as the install year, marked a guess` };
  }
  const found = findYears(cell, "an age");
  if (found.problem) return { value: null, problem: found.problem };
  if (found.unknown) {
    return { value: null, note: `Read ${quote(text)} as no install year, so it uses the year built, marked an estimate` };
  }
  let age = found.value;
  let used = "";
  if (found.range) {
    // The older end, so the replacement is planned no later than it might be due.
    age = found.range[1];
    used = `Used the older age of ${quote(text)}. `;
  }
  if (age === null) return { value: null };
  if (age < 0 || age > 150) return { value: null, problem: `${quote(text)} isn't an age in years.` };
  const year = sheetYear - Math.round(age);
  const problem = checkInstallYear(year, currentYear);
  if (problem) return { value: null, problem: `An age of ${quote(text)} in ${sheetYear} gives ${year}. ${problem}` };
  const counted = /^\d/.test(text)
    ? `Counted ${plural(Math.round(age), "year")} back from ${sheetYear}`
    : `Read ${quote(text)} in ${sheetYear}`;
  return { value: year, guess: true, note: `${used}${counted}: installed about ${year}, marked a guess` };
}

const NOW = /^(?:now|asap|overdue|past due|due|due now|immediately|immediate|this year|replace now|urgent|0 years?)$/i;

/** Install year from the years of life left on the sheet: the sheet's year, plus years left, minus the life. */
export function readRemaining(cell: Cell, sheetYear: number, life: number | null, currentYear: number): Reading<number> {
  const text = cellText(cell);
  const found: FoundYears = NOW.test(text)
    ? { value: 0, guess: false, unknown: false }
    : findYears(cell, "the years left");
  if (found.problem) return { value: null, problem: found.problem };
  if (found.unknown) {
    return { value: null, note: `Read ${quote(text)} as no install year, so it uses the year built, marked an estimate` };
  }
  let left = found.value;
  let used = "";
  if (found.range) {
    // The shorter end, so the replacement is planned no later than it might be due.
    left = found.range[0];
    used = `Used the shorter time of ${quote(text)}. `;
  }
  if (left === null) return { value: null };
  if (left < -100 || left > 150) return { value: null, problem: `${quote(text)} isn't a number of years left.` };
  if (life === null) {
    return {
      value: null,
      needsLife: true,
      problem: `Add a useful life, so the install year can be worked out from the years left (${quote(text)}).`,
    };
  }
  const rounded = Math.round(left);
  const year = sheetYear + rounded - life;
  const problem = checkInstallYear(year, currentYear);
  if (problem) {
    return {
      value: null,
      problem: `${plural(rounded, "year")} left of ${aLife(life)} in ${sheetYear} gives ${year}. Check the useful life, or type the install year.`,
    };
  }
  return {
    value: year,
    guess: true,
    note: `${used}${plural(rounded, "year")} left of ${aLife(life)} in ${sheetYear}: installed about ${year}, marked a guess`,
  };
}

/** Install year from a "replace by" year on the sheet: that year minus the life. */
export function readReplaceBy(cell: Cell, sheetYear: number, life: number | null, currentYear: number): Reading<number> {
  const text = cellText(cell);
  let due: number | null;
  let used = "";
  const before = text.match(/^(?:before|prior to)\s+(1[89]\d\d|2\d\d\d)$/i);
  if (NOW.test(text)) {
    due = sheetYear;
  } else if (/^next year$/i.test(text)) {
    due = sheetYear + 1;
  } else if (before) {
    // Before 2030 is 2029 at the latest.
    due = Number(before[1]) - 1;
    used = `Read ${quote(text)} as ${due}. `;
  } else {
    const found = findYear(cell);
    const range = text.match(/^\s*(?:by\s+)?(1[89]\d\d|2\d\d\d)\s*(?:-|–|—|to|or)\s*(1[89]\d\d|2\d\d\d)\s*$/i);
    if (range) {
      // The earlier end, so the replacement is planned no later than it might be due.
      due = Math.min(Number(range[1]), Number(range[2]));
      used = `Used the earlier year of ${quote(text)}. `;
    } else if (found.problem) {
      return { value: null, problem: found.problem.replace("Type the one to use.", "Type the year to replace it by.") };
    } else if (found.unknown) {
      return { value: null, note: `Read ${quote(text)} as no install year, so it uses the year built, marked an estimate` };
    } else {
      due = found.year;
    }
  }
  if (due === null) return { value: null };
  if (due < EARLIEST_YEAR || due > currentYear + 150) return { value: null, problem: `${quote(text)} isn't a year to replace by.` };
  if (life === null) {
    return {
      value: null,
      needsLife: true,
      problem: `Add a useful life, so the install year can be worked out from the replace-by year (${quote(text)}).`,
    };
  }
  const year = due - life;
  const problem = checkInstallYear(year, currentYear);
  if (problem) {
    return {
      value: null,
      problem: `Replacing by ${due} with ${aLife(life)} gives ${year}. Check the useful life, or type the install year.`,
    };
  }
  return {
    value: year,
    guess: true,
    note: `${used}Replace by ${due} with ${aLife(life)}: installed about ${year}, marked a guess`,
  };
}

/** A useful life in whole years from 1 to 100. A range uses the shorter life. */
export function readLife(cell: Cell): Reading<number> {
  const text = cellText(cell);
  const found = findYears(cell, "a useful life");
  if (found.problem) return { value: null, problem: found.problem };
  if (found.unknown) return { value: null, note: `Read ${quote(text)} as no useful life` };
  let life = found.value;
  let note: string | undefined;
  if (found.range) {
    life = found.range[0];
    note = `Used the shorter life of ${quote(text)}: ${life} years`;
  }
  if (life === null) return { value: null };
  const whole = Math.round(life);
  if (whole < 1 || whole > 100) return { value: null, problem: `A useful life of ${quote(text)} should be from 1 to 100 years.` };
  if (whole !== life && !note) note = `Rounded the useful life ${quote(text)} to ${whole} years`;
  return { value: whole, note };
}

const MONEY_SUFFIX =
  /\s*(?:\/\s*|per\s+|a\s+)?(?:ea\.?|each|apiece|unit|apt|apartment|door|piece|pc|item|installed|inst\.?|sq\.?\s*ft\.?|square\s+(?:foot|feet)|sf|sqft|psf|ft)\s*$/i;
const PER_SQ_FT = /(?:\/\s*|\bper\s+|\ba\s+|\d\s*)(?:sq\.?\s*ft\.?|square\s+(?:foot|feet)|sf|sqft|ft2|ft²)\s*$|\d\s*psf\s*$/i;

/** A cost that says it's per square foot: "$4 per sq ft", "4/sf", "$3.50 psf". */
export function saysPerSqFt(cell: Cell): boolean {
  return typeof cell === "string" && PER_SQ_FT.test(cellText(cell));
}

const AMOUNT = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)\s*(k|m|mm)?`;

function amount(text: string): number | null {
  const m = text.match(new RegExp(`^\\$?\\s*${AMOUNT}$`, "i"));
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  const scale = m[2] ? (m[2].toLowerCase() === "k" ? 1_000 : 1_000_000) : 1;
  // Rounds away float noise such as 1.4 × 1000 = 1399.9999999999998.
  return Math.round(n * scale * 1e6) / 1e6;
}

function money(value: number): string {
  return formatUnitPrice(value);
}

/**
 * A cost: "$1,400", "1.4k" and "1,400 ea" are read as they are. A range such as
 * "1200–1500" uses the higher figure, and says so.
 */
export function readMoney(cell: Cell): Reading<number> & { range?: boolean } {
  if (typeof cell === "number") {
    if (!Number.isFinite(cell) || cell < 0) return { value: null, problem: `Couldn't read ${quote(String(cell))} as a cost.` };
    return cell < MAX_COST ? { value: cell } : { value: null, problem: `${quote(String(cell))} is too large for a cost.` };
  }
  const text = cellText(cell);
  if (text === "") return { value: null };
  if (UNKNOWN.test(text) || /^(?:call|quote|see quote|get quote|varies)$/i.test(text)) {
    return { value: null, note: `Left the cost blank (${quote(text)})` };
  }
  if (/^free$/i.test(text)) return { value: 0, note: `Read ${quote(text)} as $0` };
  const { rest, guess } = withoutGuessWords(text);
  const bare = rest.replace(/\s*usd\b/i, "").replace(MONEY_SUFFIX, "").trim();
  const parts = bare.split(/\s*(?:-|–|—|\bto\b)\s*/i);
  let value: number | null = null;
  let note: string | undefined;
  let range = false;
  if (parts.length === 2 && parts.every((p) => amount(p) !== null)) {
    const [a, b] = parts.map((p) => amount(p) as number);
    // A range: plan for the higher figure.
    value = Math.max(a, b);
    note = `Used the higher figure of ${quote(text)}: ${money(value)}`;
    range = true;
  } else {
    value = amount(bare);
    if (value !== null && (guess || /\d\s*(?:k|m)/i.test(bare))) note = `Read ${quote(text)} as ${money(value)}`;
  }
  if (value === null) {
    const problem = /^\(.*\)$|^-/.test(bare)
      ? `${quote(text)} is below zero. Type the cost to replace it.`
      : `Couldn't read ${quote(text)} as a cost.`;
    return { value: null, problem };
  }
  if (value >= MAX_COST) return { value: null, problem: `${quote(text)} is too large for a cost.` };
  return range ? { value, note, range } : { value, note };
}

const QUANTITY_WORDS =
  /^(?:x\s*)?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:x|ea\.?|each|units?|pcs?\.?|pieces?|items?|total|nos?\.?|ct\.?|count|(sq\.?\s*ft\.?|square\s+(?:feet|foot)|sf|sqft|ft2|ft²))?$/i;

/** A count, or square feet: "12", "x12", "12 ea", "1,200 sq ft". Zero is returned as 0. */
export function readQuantity(cell: Cell): Reading<number> & { squareFeet?: boolean } {
  const text = cellText(cell);
  if (typeof cell === "number") {
    if (!Number.isFinite(cell) || cell < 0) return { value: null, problem: `Couldn't read ${quote(text)} as a quantity.` };
    return cell < MAX_QUANTITY
      ? { value: cell, squareFeet: false }
      : { value: null, problem: `${quote(text)} is too large for a quantity.` };
  }
  if (text === "") return { value: null };
  const m = text.match(QUANTITY_WORDS);
  if (!m) {
    const range = /^\d+(?:\.\d+)?\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?$/i.test(text);
    return {
      value: null,
      problem: range ? `Quantity ${quote(text)} is a range. Type one number.` : `Couldn't read ${quote(text)} as a quantity.`,
    };
  }
  const value = Number(m[1].replace(/,/g, ""));
  if (value >= MAX_QUANTITY) return { value: null, problem: `${quote(text)} is too large for a quantity.` };
  return { value, squareFeet: m[2] !== undefined };
}

const CONDITION_WORDS: Record<ComponentCondition, RegExp> = {
  good: /^(?:good|g|excellent|exc|great|very good|new|like new|brand new)$/i,
  fair: /^(?:fair|f|ok|okay|average|avg|so so|so-so|decent|worn|aging|moderate)$/i,
  poor: /^(?:poor|p|bad|very poor|failing|failed|broken|needs replacing|needs replacement|replace|end of life|eol)$/i,
};

const CONDITION_NAME: Record<ComponentCondition, string> = { good: "Good", fair: "Fair", poor: "Poor" };

/**
 * Good, fair or poor. Other words aren't guessed at: they're kept, for the notes.
 */
export function readCondition(cell: Cell): Reading<ComponentCondition> & { keep?: string } {
  const text = cellText(cell);
  if (text === "" || UNKNOWN.test(text)) return { value: null };
  for (const condition of ["good", "fair", "poor"] as const) {
    if (CONDITION_WORDS[condition].test(text)) {
      const exact = text.toLowerCase() === condition;
      return { value: condition, note: exact ? undefined : `Read ${quote(text)} as ${CONDITION_NAME[condition]}` };
    }
  }
  return { value: null, keep: text, note: `Put the condition ${quote(text)} in the notes` };
}

const YES_WORDS = /^(?:yes|y|true|x|✓|✔|1|guess|guessed|estimate|estimated|replace|now)$/i;
const NO_WORDS = /^(?:no|n|false|0|-+|–|—)$/i;

/** A cell that says yes or no, as a yes or no column would have it. */
export function isYesNo(text: string): boolean {
  return YES_WORDS.test(text) || NO_WORDS.test(text);
}

/** A yes or no column, like "Install year is a guess" or "Replace now". Blank is no. */
export function readYesNo(cell: Cell): Reading<boolean> {
  if (typeof cell === "boolean") return { value: cell };
  const text = cellText(cell);
  if (text === "" || NO_WORDS.test(text)) return { value: false };
  if (YES_WORDS.test(text)) return { value: true };
  return { value: false, note: `Read ${quote(text)} as no` };
}

const COUNTED: [UnitLabel, RegExp][] = [
  ["per_sq_ft", /^(?:per\s+)?(?:sq\.?\s*ft\.?|square\s+(?:foot|feet)|sf|sqft|ft2|ft²)$/i],
  ["per_unit", /^(?:per\s+|each\s+)?(?:unit|apt|apartment|door|suite)s?$/i],
  ["per_building", /^(?:per\s+|whole\s+|the\s+)?(?:building|bldg|property|each|item|one)s?$/i],
];

/** "Counted per": unit, building or sq ft. Null for a blank, or a word that isn't one of them. */
export function readCountedPer(cell: Cell): Reading<UnitLabel> {
  const text = cellText(cell);
  if (text === "") return { value: null };
  const found = COUNTED.find(([, words]) => words.test(text));
  if (found) return { value: found[0] };
  return { value: null, note: `Couldn't read ${quote(text)} as unit, building or sq ft, so used the usual way of counting it` };
}

/** Most units a property can have, matching the save limit. */
const MAX_UNITS = 100_000;

/** A building's unit count: a whole number like 12, "12" or "12 units". */
export function readUnitCount(cell: Cell): Reading<number> {
  const text = cellText(cell);
  if (text === "") return { value: null };
  const m = text.match(/^(\d{1,3}(?:,\d{3})+|\d+)(?:\.0+)?\s*(?:units?|apts?\.?|apartments?|doors?)?$/i);
  const value = m ? Number(m[1].replace(/,/g, "")) : Number.NaN;
  if (!Number.isInteger(value) || value < 1 || value > MAX_UNITS) {
    return { value: null, problem: `Couldn't read ${quote(text)} as a number of units.` };
  }
  return { value };
}

/** Earliest year built, matching the calculator. */
const EARLIEST_YEAR_BUILT = 1800;

/** A building's year built: 1998, "approx 1998", or an Excel date. */
export function readYearBuilt(cell: Cell, currentYear: number): Reading<number> {
  const text = cellText(cell);
  if (text === "") return { value: null };
  const found = findYear(cell);
  if (found.unknown) return { value: null };
  if (found.year === null || found.problem || found.year < EARLIEST_YEAR_BUILT || found.year > currentYear) {
    return { value: null, problem: `Couldn't read ${quote(text)} as the year built.` };
  }
  return { value: found.year, guess: found.guess };
}
