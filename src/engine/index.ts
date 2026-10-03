// The engine's public entry. Verticals import from "@/engine" only, never a file inside it.
export type {
  AssetGroup,
  AtRiskComponent,
  Component,
  ComponentLife,
  EstimateFlags,
  ExpensePlan,
  ForecastInput,
  ForecastOptions,
  ForecastResult,
  ForecastSummary,
  FundingYear,
  GroupForecast,
  LevelReserve,
  LifeStatus,
  NextReplacement,
  PlannedExpense,
  Replacement,
  ReplacementCycle,
  RiskStatus,
  RollupTotals,
  Scenario,
  ScenarioComparison,
  ScenarioFigures,
  SingleComponentReserve,
  YearAdjustment,
  YearSummary,
} from "./types";
export {
  AT_RISK_YEARS,
  DEFAULT_HORIZON_YEARS,
  DEFAULT_RESERVE_HORIZON_YEARS,
  MAX_HORIZON_YEARS,
  MAX_INFLATION_RATE,
  MAX_YEARS_UNTIL_DUE,
} from "./constants";
export { assertForecastOptions, validateComponent } from "./validate";
export {
  endOfLifeYear,
  estimateFlags,
  inflationFactor,
  isEstimate,
  nextReplacementYear,
  replacementCost,
} from "./component";
export { projectReplacements } from "./project";
export { summarizeForecast } from "./summarize";
export { fundingSchedule, levelMonthlyReserve, nextReplacementReserve, planExpenses } from "./reserve";
export { componentLife, findAtRisk, lifeStatus } from "./risk";
export {
  compareScenarios,
  computeForecast,
  forecastAssetGroups,
  nextReplacementYears,
  rollupForecasts,
  withScenario,
} from "./forecast";
export { nextDueDistribution, replacementCycles } from "./renewal";
