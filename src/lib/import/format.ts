import type { FieldKind } from "./columns";
import { words } from "./text";

/** One column of CapexClock's own spreadsheet format. */
export interface FormatColumn {
  heading: string;
  /** What the importer reads the column as. */
  field: FieldKind;
  /** What to put in it, for the template page. */
  what: string;
  /** Why it's worth tracking, for the template page. */
  why: string;
}

/**
 * The one list of columns behind the template, the component list download and
 * the importer, in the order they appear in the files.
 */
export const FORMAT_COLUMNS: readonly FormatColumn[] = [
  {
    heading: "Building",
    field: "building",
    what: "The building's name or address. The same on every row for that building.",
    why: "One sheet can hold several buildings. Signed in, each one becomes its own property.",
  },
  {
    heading: "Units",
    field: "unitCount",
    what: "How many rental units the building has.",
    why: "Gives the monthly reserve per unit.",
  },
  {
    heading: "Year built",
    field: "yearBuilt",
    what: "The year the building was built.",
    why: "Stands in for any install year you don't know, marked as an estimate.",
  },
  {
    heading: "Component",
    field: "item",
    what: "What it is, like Asphalt shingle roof, Water heater, Furnace or Refrigerator.",
    why: "Names we know fill in the category and a typical useful life. For a short name like Roof, the import asks which kind.",
  },
  {
    heading: "Category",
    field: "category",
    what: "Roofing, HVAC, Plumbing, Appliances and so on. Optional.",
    why: "Groups costs in the chart. Components we know fill it in.",
  },
  {
    heading: "Quantity",
    field: "quantity",
    what: "How many there are, or the square feet for flooring and paving. For something counted per unit, leave it blank to use the unit count, as a downloaded component list does.",
    why: "The cost of a replacement is the quantity times the cost each.",
  },
  {
    heading: "Counted per",
    field: "countedPer",
    what: "One of unit, building or sq ft.",
    why: "Says what one cost pays for: one apartment's worth, the whole building, or one square foot.",
  },
  {
    heading: "Install year",
    field: "installYear",
    what: "The year it was installed or last replaced. Leave it blank if you don't know.",
    why: "With the useful life, it says when the next replacement is due.",
  },
  {
    heading: "Install year is a guess",
    field: "guess",
    what: "Put yes if the install year is your best guess. Otherwise leave it blank.",
    why: "Guesses are marked, so you know which dates to check first.",
  },
  {
    heading: "Useful life",
    field: "life",
    what: "How many years it lasts, like 10 for a tank water heater.",
    why: "Sets how often it's replaced over the next 30 years.",
  },
  {
    heading: "Cost each",
    field: "cost",
    what: "What one replacement costs today, from a quote or your estimate. Per square foot for flooring and paving.",
    why: "Costs are in today's dollars, so update them as quotes change.",
  },
  {
    heading: "Condition",
    field: "condition",
    what: "Good, Fair or Poor. Optional.",
    why: "A quick note of what you saw on your last walk-through.",
  },
  {
    heading: "Replace now",
    field: "replaceNow",
    what: "Put yes to plan its replacement this year, even if it still works.",
    why: "Puts the cost in this year and starts its cycle again from now.",
  },
  {
    heading: "Notes",
    field: "notes",
    what: "Anything to remember: brand, model, where it is, who quoted it.",
    why: "Kept with the item and shown in your PDF.",
  },
  {
    heading: "CapexClock ID",
    field: "id",
    what: "Leave it as it is, or blank for a new row.",
    why: "Filled in when you download your component list, so importing it again updates those rows instead of adding them twice.",
  },
];

export const FORMAT_HEADINGS: readonly string[] = FORMAT_COLUMNS.map((c) => c.heading);

/** A heading's field in our format, by its words, so "install year is a guess" and "Install Year Is A Guess" match. */
const FORMAT_FIELDS = new Map(FORMAT_COLUMNS.map((c) => [words(c.heading), c.field]));

/** Headings no one else's sheet is likely to have, so their presence means our format. */
const OWN_HEADINGS = new Set(["capexclock id", "counted per", "install year is a guess"]);

/** The sheet is our template or a component list download, so its headings mean exactly what they say. */
export function isCapexClockFormat(heads: readonly string[]): boolean {
  return heads.some((h) => OWN_HEADINGS.has(words(h)));
}

/** A heading's field in our format, or null when it isn't one of ours. */
export function formatField(heading: string): FieldKind | null {
  return FORMAT_FIELDS.get(words(heading)) ?? null;
}

/**
 * The forecast download's headings, which every copy of it has had. Its last
 * column was "Note" until condition and notes were added, and is "Forecast note" now.
 */
const FORECAST_HEADINGS = ["year", "component", "quantity", "unit", "cost each", "total cost"];
const FORECAST_NOTE = ["forecast note", "note"];

/**
 * The headings are the forecast CSV's, old or new, which lists replacements, not
 * components: its Year is when each one is due, not when it was installed. It
 * takes all of them, so an owner's own sheet with a Year and a Total cost isn't
 * mistaken for it.
 */
export function isForecastCsv(heads: readonly string[]): boolean {
  const have = new Set(heads.map(words));
  return FORECAST_HEADINGS.every((h) => have.has(h)) && FORECAST_NOTE.some((h) => have.has(h));
}

/** "yes" in the files we write. Blank means no. */
export const YES = "yes";

/** How "Counted per" is written for each way of counting. */
export const COUNTED_PER_TEXT = {
  per_unit: "unit",
  per_building: "building",
  per_sq_ft: "sq ft",
} as const;

/** The template and the filled-in example, by their file names without the extension. */
const TEMPLATE_NAMES = { template: "capexclock-template", example: "capexclock-example" } as const;

export type TemplateFile = keyof typeof TEMPLATE_NAMES;

/**
 * The downloads come as Excel files and as CSV. Excel opens an .xlsx file as it is,
 * while Excel for Mac can open a CSV in its Text Import Wizard, which guesses the
 * columns wrong.
 */
export const TEMPLATE_FORMATS = ["xlsx", "csv"] as const;

export type TemplateFormat = (typeof TEMPLATE_FORMATS)[number];

/** Where the template or the example is served from /capex-spreadsheet-template, and its file name. */
export function templateFile(file: TemplateFile, format: TemplateFormat): { path: string; name: string } {
  const name = `${TEMPLATE_NAMES[file]}.${format}`;
  return { path: `/capex-spreadsheet-template/${name}`, name };
}
