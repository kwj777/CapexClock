export type UnitLabel = "per_unit" | "per_building" | "per_sq_ft";

/** "replace_now" pulls the next replacement into the first forecast year. */
export type Scenario = "run_to_failure" | "replace_now";

export interface ForecastComponent {
  id: string;
  category: string;
  name: string;
  /** Number of items, or square feet when priced per sq ft. */
  quantity: number;
  installYear: number;
  /** True when the install year was defaulted to the building's year built. */
  installYearIsEstimate?: boolean;
  usefulLifeYears: number;
  /** Cost to replace one item (or one sq ft). */
  replacementCostEach: number;
  scenario?: Scenario;
}

export interface ForecastInput {
  /** First year of the window, normally the current year. */
  startYear: number;
  /** Window length in years. Defaults to 10. */
  years?: number;
  unitCount: number;
  components: ForecastComponent[];
}

export interface Replacement {
  componentId: string;
  name: string;
  category: string;
  year: number;
  cost: number;
  /** Past end of life at the start of the window, so pulled into year one. */
  overdue: boolean;
}

export interface ForecastYear {
  year: number;
  total: number;
  byCategory: Record<string, number>;
  replacements: Replacement[];
}

export type RiskStatus = "overdue" | "due_soon";

export interface AtRiskItem {
  componentId: string;
  name: string;
  category: string;
  endOfLifeYear: number;
  /** Negative when already past end of life. */
  yearsRemaining: number;
  status: RiskStatus;
  installYearIsEstimate: boolean;
}

export interface Forecast {
  startYear: number;
  endYear: number;
  years: ForecastYear[];
  /** Sum of every replacement in the window. */
  total: number;
  /** First-year costs (overdue or due this year): cash needed now, not saved for monthly. */
  neededNow: number;
  /** Level monthly deposit that covers every later replacement on time; see levelMonthlyReserve. */
  monthlyReserve: number;
  /** Null when the unit count is zero. */
  monthlyReservePerUnit: number | null;
  /**
   * Replacements after the window that the monthly reserve is already saving
   * for, up to the year that sets its amount. Empty when the window explains it.
   */
  savingAhead: Replacement[];
  atRisk: AtRiskItem[];
}
