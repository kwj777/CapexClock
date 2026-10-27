import { endOfLifeYear, nextReplacementReserve, replacementCost } from "@/engine";
import { EARLIEST_INSTALL_YEAR } from "./draft/components";
import { defaultLife, type LibraryComponent } from "./library/components";
import { readNumber } from "./parse";
import { LANDLORD_RULES } from "./rules";

export interface LifespanResult {
  /** Install year + the library's middle life. */
  readonly due: number;
  /** Install year + the low and high ends of the library's range. */
  readonly low: number;
  readonly high: number;
  /** due − this year; negative once it's past. */
  readonly yearsLeft: number;
  /** The three figures below are null until a usable quantity and cost are typed. */
  readonly monthly: number | null;
  readonly neededNow: number | null;
  /** The replacement the monthly amount saves for. */
  readonly savingFor: number | null;
  /**
   * The building forecast looks LANDLORD_RULES.reserveHorizonYears ahead, so it leaves
   * out a later replacement for now: the year it starts counting it, or null.
   */
  readonly forecastCountsFrom: number | null;
  /**
   * For an item redone as tenants move out (see TURNOVER_SLUGS): the monthly amount
   * if a set share is redone each year, cost ÷ life ÷ 12, next to `monthly`, which
   * has them all done at once. Null for other items, or before there's a monthly amount.
   */
  readonly spreadMonthly: number | null;
}

/**
 * Items an owner usually redoes one apartment at a time as tenants move out, so the
 * page also shows what spreading them out costs. Interior paint only once there's more
 * than one apartment; carpet is counted in square feet across the building.
 */
const TURNOVER_SLUGS: ReadonlySet<string> = new Set(["interior-paint", "carpet"]);

/** Why no dollar figure shows yet, once a cost has been typed, and which field it's about. */
export interface LifespanMoneyHint {
  readonly text: string;
  readonly field: "cost" | "quantity";
  readonly invalid: boolean;
}

export interface LifespanEstimate {
  readonly life: number;
  /** Something was typed in the year field that isn't a year from EARLIEST_INSTALL_YEAR to this year. */
  readonly badYear: boolean;
  /** Null until a usable install year is typed. */
  readonly result: LifespanResult | null;
  readonly moneyHint: LifespanMoneyHint | null;
}

/**
 * "When will mine need replacing, and what should I set aside?" for one library
 * component on a lifespan page, from what's typed in its three fields.
 */
export function lifespanEstimate(input: {
  readonly item: LibraryComponent;
  readonly installYear: string;
  readonly quantity: string;
  readonly costEach: string;
  readonly currentYear: number;
}): LifespanEstimate {
  const { item, currentYear } = input;
  const life = defaultLife(item);
  const year = readNumber(input.installYear);
  const validYear = year !== null && Number.isInteger(year) && year >= EARLIEST_INSTALL_YEAR && year <= currentYear;
  const badYear = input.installYear.trim() !== "" && !validYear;
  if (year === null || !validYear) return { life, badYear, result: null, moneyHint: null };

  const qty = readNumber(input.quantity);
  const each = readNumber(input.costEach);
  const sqFt = item.unitLabel === "per_sq_ft";
  let moneyHint: LifespanMoneyHint | null = null;
  let reserve: { monthly: number; neededNow: number; savingFor: number } | null = null;
  let spreadMonthly: number | null = null;
  if (each !== null && (Number.isNaN(each) || each < 0)) {
    moneyHint = { text: "Enter the cost as a plain number, like 1400.", field: "cost", invalid: true };
  } else if (each !== null && qty === null) {
    moneyHint = {
      text: sqFt ? "Enter the square feet to see a monthly amount." : "Enter how many to see a monthly amount.",
      field: "quantity",
      invalid: false,
    };
  } else if (each !== null && qty !== null && (Number.isNaN(qty) || qty <= 0)) {
    moneyHint = {
      text: sqFt ? "Enter the square feet as a number, like 1200." : "Enter how many as a number, like 12.",
      field: "quantity",
      invalid: true,
    };
  } else if (each !== null && qty !== null) {
    reserve = nextReplacementReserve(
      { id: item.slug, category: item.category, name: item.name, quantity: qty, installYear: year, usefulLifeYears: life, replacementCostEach: each },
      currentYear,
    );
    if (TURNOVER_SLUGS.has(item.slug) && (sqFt || qty > 1)) {
      spreadMonthly = replacementCost({ quantity: qty, replacementCostEach: each }) / life / 12;
    }
  }

  const due = endOfLifeYear({ installYear: year, usefulLifeYears: life });
  const savingFor = reserve?.savingFor ?? null;
  const lookAhead = LANDLORD_RULES.reserveHorizonYears;
  return {
    life,
    badYear,
    moneyHint,
    result: {
      due,
      low: endOfLifeYear({ installYear: year, usefulLifeYears: item.lifeLow }),
      high: endOfLifeYear({ installYear: year, usefulLifeYears: item.lifeHigh }),
      yearsLeft: due - currentYear,
      monthly: reserve?.monthly ?? null,
      neededNow: reserve?.neededNow ?? null,
      savingFor,
      forecastCountsFrom: savingFor !== null && savingFor > currentYear + lookAhead ? savingFor - lookAhead : null,
      spreadMonthly,
    },
  };
}
