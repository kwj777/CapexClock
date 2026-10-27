import { computeForecast, replacementCycles, validateComponent, type Component } from "@/engine";
import { badYearBuilt, YEAR_BUILT_TEXT } from "./draft/components";
import { defaultLife, type LibraryComponent } from "./library/components";
import type { TypicalCost } from "./library/typical-costs";
import { readNumber } from "./parse";
import { LANDLORD_RULES, landlordOptions } from "./rules";

/**
 * The quick estimate: a per-unit monthly reserve range from a unit count, a year
 * built and the systems the building has, priced at typical costs. Typical costs
 * are never saved or used in a property's forecast; the estimate is only shown.
 * The assumptions below are in typical-costs.md, which Kevin approved on
 * October 2, 2026.
 */

/** Building-wide items are priced per apartment for a building this size. */
export const ESTIMATE_BUILDING_UNITS = 12;
/** Items for the whole building, shared out per apartment as if for ESTIMATE_BUILDING_UNITS units. */
export const BUILDING_WIDE: ReadonlySet<string> = new Set([
  "asphalt-shingle-roof",
  "flat-membrane-roof",
  "gutters",
  "boiler",
  "exterior-paint",
  "vinyl-siding",
  "fire-alarm-panel",
]);

/**
 * True when a building smaller than the one the estimate assumes has a
 * whole-building item ticked, so its real share per unit is likely higher.
 */
export function smallBuildingShare(ticked: ReadonlySet<string>, units: number): boolean {
  return units < ESTIMATE_BUILDING_UNITS && [...ticked].some((slug) => BUILDING_WIDE.has(slug));
}

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
 * How the year built is used. Kevin chose spreading (true) on October 2, 2026, in
 * typical-costs.md ("A choice for you"). True: each system lasts anywhere in its
 * lifespan range, and each replacement lands up to GIVE_OR_TAKE_YEARS early or
 * late, so its cost is spread over the years it could come due. False: each lasts
 * exactly the middle of its range, the plan's method, which jumps up to 4 times
 * between neighboring build years when several systems come due together.
 */
export const SPREAD_REPLACEMENTS = true;
/** How many years early or late each replacement may land, when replacements are spread. */
export const GIVE_OR_TAKE_YEARS = 2;

/**
 * The lives a system is spread across. Spread: every whole year of its lifespan
 * range, in equal parts, each replacement landing up to GIVE_OR_TAKE_YEARS early
 * or late (see the engine's nextDueDistribution: the older the building, the more
 * evenly its next replacement spreads across the life). Not spread: the middle of
 * the range, replaced exactly on schedule.
 */
export function livesFor(item: LibraryComponent, spread: boolean): number[] {
  return spread
    ? Array.from({ length: item.lifeHigh - item.lifeLow + 1 }, (_, i) => item.lifeLow + i)
    : [defaultLife(item)];
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
 * replaced on schedule since the building was built (see livesFor), so
 * nothing is overdue. Null when nothing ticked can be priced, there are no units,
 * or there are too many to work out.
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
  if (included.length === 0 || !(units > 0)) return null;
  const shares = jobShares(new Set(included.map((s) => s.item.slug)));
  // The reserve only depends on how much comes due when, so every share on the same schedule (the
  // same life, next due the same year) is added into one bill. That keeps it quick to work out.
  const bills = new Map<string, { life: number; due: number; low: number; high: number }>();
  for (const s of included) {
    const amount = units * s.perApartment * (shares.get(s.item.slug) ?? 1);
    const cycles = replacementCycles(livesFor(s.item, spread), yearBuilt, currentYear, spread ? GIVE_OR_TAKE_YEARS : 0);
    for (const cycle of cycles) {
      // A share first due past the reserve's 30 years ahead adds nothing to it.
      if (cycle.due > currentYear + LANDLORD_RULES.reserveHorizonYears) continue;
      const key = `${cycle.life}:${cycle.due}`;
      const bill = bills.get(key) ?? { life: cycle.life, due: cycle.due, low: 0, high: 0 };
      bill.low += amount * cycle.share * s.cost.low;
      bill.high += amount * cycle.share * s.cost.high;
      bills.set(key, bill);
    }
  }
  const perUnit = (end: "low" | "high") => {
    const components = [...bills.values()].map(
      (bill, i): Component => ({
        id: `bill-${i}`,
        category: "Quick estimate",
        name: `Due ${bill.due}`,
        quantity: 1,
        installYear: bill.due - bill.life,
        usefulLifeYears: bill.life,
        replacementCostEach: bill[end],
      }),
    );
    // So many units that a cost can't be worked out gives no estimate rather than an error.
    if (components.some((c) => validateComponent(c).length > 0)) return NaN;
    return computeForecast({ ...landlordOptions(currentYear), components }).monthlyReserve / units;
  };
  const estimate = { perUnit: { low: perUnit("low"), high: perUnit("high") }, systems: included.length };
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

/** The estimate as shown: each end rounded up, and the building's figure from the rounded per-unit one. */
export interface EstimateFigures {
  perUnit: { low: number; high: number };
  building: { low: number; high: number };
}

/** Rounds each end up (roundEstimate) and multiplies the rounded figures out, so the two always agree. */
export function estimateFigures(estimate: QuickEstimate, units: number): EstimateFigures {
  const low = roundEstimate(estimate.perUnit.low);
  const high = roundEstimate(estimate.perUnit.high);
  return { perUnit: { low, high }, building: { low: low * units, high: high * units } };
}

export interface QuickInputs {
  /** Null while blank or unusable. */
  units: number | null;
  yearBuilt: number | null;
  unitsProblem: string | null;
  yearBuiltProblem: string | null;
}

/** The most units the quick estimate takes: far more than any building it's for, and few enough to multiply out. */
export const MAX_QUICK_UNITS = 100_000;
export const QUICK_UNITS_PROBLEM = "Enter units as a whole number from 1 to 100,000, like 12.";

/** Reads the unit count and year built. The year follows the calculators' rule and wording. */
export function readQuickInputs(units: string, yearBuilt: string, currentYear: number): QuickInputs {
  const unitsValue = readNumber(units);
  const unitsOk =
    unitsValue === null || (Number.isInteger(unitsValue) && unitsValue > 0 && unitsValue <= MAX_QUICK_UNITS);
  const yearValue = readNumber(yearBuilt);
  const yearOk = !badYearBuilt(yearBuilt, currentYear);
  return {
    units: unitsOk ? unitsValue : null,
    yearBuilt: yearOk ? yearValue : null,
    unitsProblem: unitsOk ? null : QUICK_UNITS_PROBLEM,
    yearBuiltProblem: yearOk ? null : YEAR_BUILT_TEXT,
  };
}
