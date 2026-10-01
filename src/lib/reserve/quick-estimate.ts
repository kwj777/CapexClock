import { badYearBuilt, YEAR_BUILT_TEXT } from "@/components/calculator/draft";
import { computeForecast, validateComponent, type ForecastComponent } from "@/lib/forecast";
import { defaultLife, type LibraryComponent, type TypicalCost } from "@/lib/library/components";

/**
 * The quick estimate: a per-unit monthly reserve range from a unit count, a year
 * built and the systems the building has, priced at typical costs. Typical costs
 * are never saved or used in a property's forecast; the estimate is only shown.
 * The assumptions below are in typical-costs.md, which Kevin approved.
 */

/** Building-wide items are priced per apartment for a building this size. */
export const ESTIMATE_BUILDING_UNITS = 12;
/** Carpet or plank per apartment: a 900 sq ft apartment less its kitchen and bathroom floors. */
export const FLOOR_SQ_FT_PER_APARTMENT = 800;
/** Paved parking per apartment: 1.5 spaces of about 325 sq ft each, driving lanes included. */
export const PARKING_SQ_FT_PER_APARTMENT = 500;

/** Square feet per apartment for the items priced per sq ft. Other sq ft items can't be estimated. */
const SQ_FT_PER_APARTMENT = new Map<string, number>([
  ["carpet", FLOOR_SQ_FT_PER_APARTMENT],
  ["luxury-vinyl-plank", FLOOR_SQ_FT_PER_APARTMENT],
  ["parking-lot-seal-coat", PARKING_SQ_FT_PER_APARTMENT],
  ["parking-lot-resurface", PARKING_SQ_FT_PER_APARTMENT],
]);

/** Systems that do the same job. Ticking more than one splits the job equally between them. */
export const SHARED_JOBS: readonly (readonly string[])[] = [
  ["asphalt-shingle-roof", "flat-membrane-roof"],
  ["gas-furnace", "heat-pump", "boiler"],
  ["tank-water-heater", "tankless-water-heater"],
  ["carpet", "luxury-vinyl-plank"],
];

/**
 * Ticked to start with: what a typical small apartment building has. Left out:
 * the alternatives to these (flat roof, heat pump, boiler, tankless), in-unit
 * laundry, painted walls (with siding ticked) and a fire alarm panel.
 */
export const TICKED_BY_DEFAULT: ReadonlySet<string> = new Set([
  "asphalt-shingle-roof",
  "gutters",
  "gas-furnace",
  "central-ac",
  "tank-water-heater",
  "refrigerator",
  "range-oven",
  "dishwasher",
  "carpet",
  "luxury-vinyl-plank",
  "interior-paint",
  "kitchen-cabinets",
  "laminate-countertops",
  "vinyl-windows",
  "vinyl-siding",
  "parking-lot-seal-coat",
  "parking-lot-resurface",
  "electrical-panel",
]);

export interface QuickSystem {
  item: LibraryComponent;
  cost: TypicalCost;
  /** How much one apartment has: 1 when the cost is per apartment, else its square feet. */
  perApartment: number;
}

/** The library items the quick estimate can price, in library order. */
export function quickSystems(library: LibraryComponent[], costs: TypicalCost[]): QuickSystem[] {
  const bySlug = new Map(costs.map((c) => [c.slug, c]));
  return library.flatMap((item) => {
    const cost = bySlug.get(item.slug);
    if (!cost) return [];
    const perApartment = cost.per === "apartment" ? 1 : SQ_FT_PER_APARTMENT.get(item.slug);
    return perApartment === undefined ? [] : [{ item, cost, perApartment }];
  });
}

/**
 * Kevin's choice in typical-costs.md. True: each system lasts anywhere in its
 * lifespan range and is replaced up to GIVE_OR_TAKE_YEARS either side of
 * schedule, so its cost is spread over the years it could come due. False: each
 * lasts exactly the middle of its range, the plan's first method, which jumps up
 * to 4 times between neighbouring build years when several systems come due
 * together.
 */
export const SPREAD_REPLACEMENTS = true;
/** How many years early or late a replacement may land, when replacements are spread. */
export const GIVE_OR_TAKE_YEARS = 2;

/**
 * The year a system was last replaced, if it's replaced every `life` years from
 * `start`: `start` itself until the first replacement is due. Due this year
 * counts as replaced this year, so nothing is ever overdue.
 */
export function lastReplacedOnSchedule(start: number, life: number, currentYear: number): number {
  return currentYear < start ? start : start + Math.floor((currentYear - start) / life) * life;
}

/** A share of a system on one replacement schedule. */
export interface ReplacementCycle {
  life: number;
  /** When this share was last replaced, or put in. The next replacement is `life` years later. */
  lastReplaced: number;
  /** Its part of the system, out of 1. */
  share: number;
}

/**
 * The schedules a system is split across, in equal shares. Spread: every
 * lifespan in its range, each starting from the year built or up to
 * GIVE_OR_TAKE_YEARS either side of it (a share started 2 years early comes due
 * 2 years early, and so on). Not spread: one schedule at the middle of its range.
 */
export function replacementCycles(
  item: LibraryComponent,
  yearBuilt: number,
  currentYear: number,
  spread: boolean = SPREAD_REPLACEMENTS,
): ReplacementCycle[] {
  const lives = spread
    ? Array.from({ length: item.lifeHigh - item.lifeLow + 1 }, (_, i) => item.lifeLow + i)
    : [defaultLife(item)];
  const shifts = spread ? Array.from({ length: 2 * GIVE_OR_TAKE_YEARS + 1 }, (_, i) => i - GIVE_OR_TAKE_YEARS) : [0];
  const share = 1 / (lives.length * shifts.length);
  return lives.flatMap((life) =>
    shifts.map((shift) => ({ life, lastReplaced: lastReplacedOnSchedule(yearBuilt + shift, life, currentYear), share })),
  );
}

/** Each ticked system's share of its job: 1, or an equal split with the others ticked for the same job. */
export function jobShares(ticked: ReadonlySet<string>): Map<string, number> {
  const shares = new Map<string, number>();
  for (const job of SHARED_JOBS) {
    const doing = job.filter((slug) => ticked.has(slug));
    for (const slug of doing) shares.set(slug, 1 / doing.length);
  }
  return shares;
}

export interface QuickEstimate {
  /** Monthly reserve per unit with every cost at its typical low, and at its typical high. */
  perUnit: { low: number; high: number };
  /** How many ticked systems were priced. */
  systems: number;
}

/**
 * The full calculator's reserve (the smallest level monthly deposit that pays
 * every replacement after this year on time, 30 years ahead) for the ticked
 * systems, at typical low and high costs. Each system is taken to have been
 * replaced on schedule since the building was built (see replacementCycles), so
 * nothing is overdue. Null when nothing ticked can be priced, or the unit count
 * is too big to work out.
 */
export function quickEstimate(
  systems: QuickSystem[],
  ticked: ReadonlySet<string>,
  units: number,
  yearBuilt: number,
  currentYear: number,
  spread: boolean = SPREAD_REPLACEMENTS,
): QuickEstimate | null {
  const included = systems.filter((s) => ticked.has(s.item.slug));
  if (included.length === 0) return null;
  const shares = jobShares(new Set(included.map((s) => s.item.slug)));
  const parts = included.flatMap((s) =>
    replacementCycles(s.item, yearBuilt, currentYear, spread).map((cycle) => ({ system: s, cycle })),
  );
  const components = (end: "low" | "high") =>
    parts.map(
      ({ system: s, cycle }, i): ForecastComponent => ({
        id: `${s.item.slug}-${i}`,
        category: s.item.category,
        name: s.item.name,
        quantity: units * s.perApartment * (shares.get(s.item.slug) ?? 1) * cycle.share,
        installYear: cycle.lastReplaced,
        usefulLifeYears: cycle.life,
        replacementCostEach: s.cost[end],
      }),
    );
  const low = components("low");
  const high = components("high");
  // No units, or so many that a quantity can't be worked out, gives no estimate rather than an error.
  if ([...low, ...high].some((c) => validateComponent(c).length > 0)) return null;
  const perUnit = (list: ForecastComponent[]) =>
    computeForecast({ startYear: currentYear, unitCount: units, components: list }).monthlyReserve / units;
  const estimate = { perUnit: { low: perUnit(low), high: perUnit(high) }, systems: included.length };
  return Number.isFinite(estimate.perUnit.low) && Number.isFinite(estimate.perUnit.high) ? estimate : null;
}

/**
 * Rounds an estimated monthly amount up, so it reads as an estimate and saving it
 * never falls short: to the next $5, or the next dollar under $10.
 */
export function roundEstimate(value: number): number {
  if (!(value > 0)) return 0;
  return value < 10 ? Math.ceil(value - 1e-6) : Math.ceil(value / 5 - 1e-6) * 5;
}

export interface QuickInputs {
  /** Null while blank or unusable. */
  units: number | null;
  yearBuilt: number | null;
  unitsProblem: string | null;
  yearBuiltProblem: string | null;
}

/** Null when blank; NaN when something was typed that isn't a number. */
function num(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/** The most units the quick estimate takes: far more than any building it's for, and few enough to multiply out. */
export const MAX_QUICK_UNITS = 100_000;
export const QUICK_UNITS_PROBLEM = "Enter units as a whole number from 1 to 100,000, like 12.";

/** Reads the unit count and year built. The year follows the calculators' rule and wording. */
export function readQuickInputs(units: string, yearBuilt: string, currentYear: number): QuickInputs {
  const unitsValue = num(units);
  const unitsOk =
    unitsValue === null || (Number.isInteger(unitsValue) && unitsValue > 0 && unitsValue <= MAX_QUICK_UNITS);
  const yearValue = num(yearBuilt);
  const yearOk = !badYearBuilt(yearBuilt, currentYear);
  return {
    units: unitsOk ? unitsValue : null,
    yearBuilt: yearOk ? yearValue : null,
    unitsProblem: unitsOk ? null : QUICK_UNITS_PROBLEM,
    yearBuiltProblem: yearOk ? null : YEAR_BUILT_TEXT,
  };
}
