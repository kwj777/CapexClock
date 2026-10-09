// Public types of the forecasting engine. Generic vocabulary only: nothing here
// knows about any particular audience. Audience words live in src/verticals
// (src/verticals/__tests__/engine-vocabulary.test.ts checks this).

/** How a component's next replacement is placed. */
export type Scenario = "run_to_failure" | "replace_now";

/**
 * Which of a component's inputs are estimates rather than known facts. The engine
 * never changes a number because of a flag; it carries the flags through to its
 * outputs so an app can mark the figures that rest on a guess.
 */
export interface EstimateFlags {
  readonly quantity: boolean;
  readonly installYear: boolean;
  readonly usefulLife: boolean;
  readonly replacementCost: boolean;
}

/** One thing that wears out and is replaced: a roof, a boiler, a parking lot. */
export interface Component {
  /** Unique within one input list. */
  readonly id: string;
  /** Free text. Yearly totals are also broken down by it (YearSummary.byCategory). */
  readonly category: string;
  readonly name: string;
  /** How many, priced each. Any finite number above 0, so it can be an area or a length. */
  readonly quantity: number;
  /** Whole year it was installed or last replaced. */
  readonly installYear: number;
  /** Whole years it lasts, 1 to 100. */
  readonly usefulLifeYears: number;
  /** Cost to replace one, in start-year dollars. 0 or more. */
  readonly replacementCostEach: number;
  /** Missing means "run_to_failure". */
  readonly scenario?: Scenario;
  /** Missing flags are false. */
  readonly estimated?: Partial<EstimateFlags>;
}

/** A named collection of components that are forecast together (one site, one building). */
export interface AssetGroup {
  readonly id: string;
  readonly name: string;
  readonly components: readonly Component[];
  /** Cash already saved for this group at the start. Missing means the options' balance (default 0). */
  readonly currentReserveBalance?: number;
  /** This group's safety margin on the monthly reserve. Missing means the options' rate (default 0). */
  readonly contingencyRate?: number;
}

/** A one-off amount that is not a replacement, added to one year's total (an emergency premium, say). */
export interface YearAdjustment {
  /** Whole year, startYear or later. Years past the projection are ignored. */
  readonly year: number;
  /** Start-year dollars, 0 or more (NaN refused; +Infinity from an overflowing sum passes through). Inflated like a replacement in the same year. */
  readonly amount: number;
}

/** Everything a forecast needs except the components. */
export interface ForecastOptions {
  /** First forecast year, normally the current year. Passed in: the engine never reads a clock. */
  readonly startYear: number;
  /** Years shown and totalled, from startYear. Whole number 1 to 100. Default 10. */
  readonly horizonYears?: number;
  /**
   * How many years after startYear the monthly reserve looks ahead. Whole number
   * 0 to 100. Default 30. The reserve also always covers every year of the horizon,
   * so the years projected are max(horizonYears, reserveHorizonYears + 1).
   */
  readonly reserveHorizonYears?: number;
  /** At risk = past end of life or within this many years of it. Whole number 0 to 100. Default 2. */
  readonly atRiskYears?: number;
  /** Yearly cost growth as a decimal, 0 to 1 (0.03 is 3%). Default 0: start-year dollars throughout. */
  readonly inflationRate?: number;
  /** Cash already saved at the start, 0 or more. Default 0. */
  readonly currentReserveBalance?: number;
  /** Extra one-off amounts by year. Default none. */
  readonly adjustments?: readonly YearAdjustment[];
  /**
   * Safety margin added on top of the level monthly reserve, as a decimal from 0 to 1
   * (0.1 is 10%). Default 0. Only the monthly figure grows; costs and years don't change.
   */
  readonly contingencyRate?: number;
}

export interface ForecastInput extends ForecastOptions {
  readonly components: readonly Component[];
}

/** One replacement of one component in one year. */
export interface Replacement {
  readonly componentId: string;
  readonly name: string;
  readonly category: string;
  readonly year: number;
  /** quantity × replacementCostEach, in start-year dollars. Never rounded. */
  readonly baseCost: number;
  /** baseCost × (1 + inflationRate)^(year − startYear). Exactly baseCost when inflation is 0. */
  readonly cost: number;
  /** End of life had passed before startYear, so this first replacement was pulled into startYear. */
  readonly overdue: boolean;
  readonly estimated: EstimateFlags;
}

export interface YearSummary {
  readonly year: number;
  /** Every replacement cost this year plus the year's adjustment. */
  readonly total: number;
  /** Replacement costs by category, keys in first-appearance order. Adjustments are not in it. */
  readonly byCategory: Readonly<Record<string, number>>;
  /** Adjustments landing this year, inflated; 0 when none. Already included in total. */
  readonly adjustment: number;
  /** In component input order. */
  readonly replacements: readonly Replacement[];
}

/** The level-monthly-reserve calculation on its own (see levelMonthlyReserve). */
export interface LevelReserve {
  /** Smallest level monthly deposit that pays every later year on time. Unrounded. */
  readonly monthly: number;
  /** Index of the earliest year whose bills set `monthly`; null when monthly is 0. */
  readonly tightestIndex: number | null;
  /** First-year costs the balance can't cover: max(0, totals[0] − balance). */
  readonly shortfallNow: number;
  /** Balance left after first-year costs, counted toward later years: max(0, balance − totals[0]). */
  readonly carriedForward: number;
}

/** Headline figures for one forecast. */
export interface ForecastSummary {
  readonly startYear: number;
  /** startYear + horizonYears − 1. */
  readonly endYear: number;
  readonly horizonYears: number;
  /** Total for every projected year, startYear to reserveThroughYear (index 0 = startYear): what the monthly reserve is computed from. */
  readonly reserveYearTotals: readonly number[];
  /** One entry per horizon year, contiguous, empty years included. */
  readonly years: readonly YearSummary[];
  /** Sum of years[].total. */
  readonly horizonTotal: number;
  /** years[0].total: first-year costs, shown as needed now and not spread into the monthly reserve. */
  readonly neededNow: number;
  /**
   * Smallest level monthly deposit that pays every replacement after the first year on
   * time, plus the contingency margin. Unrounded.
   */
  readonly monthlyReserve: number;
  /** The level monthly deposit before the contingency margin. Equals monthlyReserve when the rate is 0. */
  readonly monthlyReserveBeforeContingency: number;
  /** The contingency rate the forecast used (default 0). */
  readonly contingencyRate: number;
  /** First year the monthly reserve saves for: startYear + 1. */
  readonly reserveFromYear: number;
  /** Last year the monthly reserve looks at: startYear + max(horizonYears − 1, reserveHorizonYears). */
  readonly reserveThroughYear: number;
  /** The year whose bills set monthlyReserve; null when it is 0. */
  readonly tightestYear: number | null;
  /** The balance the forecast started from (currentReserveBalance, default 0). */
  readonly currentReserveBalance: number;
  /** max(0, neededNow − currentReserveBalance). Equals neededNow when the balance is 0. */
  readonly shortfallNow: number;
  /** max(0, currentReserveBalance − neededNow), counted toward later years. */
  readonly carriedForward: number;
  /**
   * Replacements after the horizon that the monthly reserve is already saving for,
   * up to tightestYear. Empty when the horizon explains the reserve.
   */
  readonly savingAhead: readonly Replacement[];
}

export type RiskStatus = "overdue" | "due_soon";
export type LifeStatus = RiskStatus | "ok";

export interface AtRiskComponent {
  readonly componentId: string;
  readonly name: string;
  readonly category: string;
  readonly endOfLifeYear: number;
  /** endOfLifeYear − currentYear. Negative once past end of life. */
  readonly yearsRemaining: number;
  readonly status: RiskStatus;
  readonly estimated: EstimateFlags;
}

/** Life facts for one component as of a year (condition reports). */
export interface ComponentLife {
  readonly componentId: string;
  /** max(0, year − installYear). */
  readonly age: number;
  readonly endOfLifeYear: number;
  readonly yearsRemaining: number;
  readonly status: LifeStatus;
  /** quantity × replacementCostEach, start-year dollars. */
  readonly replacementCost: number;
}

export interface NextReplacement {
  readonly componentId: string;
  /** First replacement on or after startYear. Not limited to the horizon. */
  readonly year: number;
  /** End of life was before startYear. */
  readonly overdue: boolean;
}

export interface ForecastResult extends ForecastSummary {
  /** Every replacement in the horizon, by year, then component input order. */
  readonly replacements: readonly Replacement[];
  /**
   * Past end of life or within atRiskYears of it at startYear. Ignores scenario.
   * Most urgent first; ties keep component input order (no locale-dependent sort in
   * the engine; a vertical orders names for display).
   */
  readonly atRisk: readonly AtRiskComponent[];
  /** One per component, in input order. */
  readonly nextReplacements: readonly NextReplacement[];
}

/** The four headline figures that two scenarios are compared on. */
export interface ScenarioFigures {
  readonly neededNow: number;
  readonly horizonTotal: number;
  readonly monthlyReserve: number;
  readonly shortfallNow: number;
}

export interface ScenarioComparison {
  readonly base: ForecastSummary;
  readonly modified: ForecastSummary;
  /** modified − base, figure by figure. */
  readonly difference: ScenarioFigures;
}

/** Saving for one component's next replacement that can still be saved for (lifespan pages). */
export interface SingleComponentReserve {
  /** Cost due in startYear (overdue, due now, or replace now), else 0. Start-year dollars. */
  readonly neededNow: number;
  /** Level monthly amount for the replacement in savingFor. No horizon cap. */
  readonly monthly: number;
  /** The year being saved for. */
  readonly savingFor: number;
}

/** A lump sum due some whole years from now (the reserve calculator's rows). */
export interface PlannedExpense {
  /** Start-year dollars. Rows that are not finite and above 0 are ignored. */
  readonly cost: number;
  /** Years from now, 0 (due now) to MAX_YEARS_UNTIL_DUE. Fractions are floored; NaN or negative rows are ignored. */
  readonly yearsUntilDue: number;
}

/** One year of a funding walk. */
export interface FundingYear {
  /** Years after the start, from 1. */
  readonly yearsFromStart: number;
  readonly deposits: number;
  readonly spent: number;
  readonly endBalance: number;
}

export interface ExpensePlan {
  readonly monthly: number;
  readonly shortfallNow: number;
  readonly carriedForward: number;
  /** Sum of every usable expense, due-now ones included. */
  readonly total: number;
  readonly schedule: readonly FundingYear[];
}

/** A share of a component on one replacement schedule (expected-schedule estimates). */
export interface ReplacementCycle {
  readonly life: number;
  /** Next due year, after currentYear. Replaced every `life` years from then. */
  readonly due: number;
  /** Its part of the component, out of 1. */
  readonly share: number;
}

export interface GroupForecast {
  readonly group: AssetGroup;
  readonly result: ForecastResult;
}

/** Plain sums across groups, in group order. */
export interface RollupTotals {
  readonly monthlyReserve: number;
  readonly neededNow: number;
  readonly horizonTotal: number;
  readonly shortfallNow: number;
  /** Number of at-risk components (not groups). */
  readonly atRiskCount: number;
}
