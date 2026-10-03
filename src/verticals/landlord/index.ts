// The landlord vertical's public entry. App code imports "@/verticals/landlord"
// only, never a file inside it, and never "@/engine".

import type { Vertical } from "../vertical";
import { LANDLORD_LABELS } from "./labels";
import { COMPONENT_LIBRARY, defaultLife, type LibraryComponent } from "./library/components";
import {
  landlordMetrics,
  portfolioMetrics,
  type LandlordFacts,
  type LandlordMetrics,
  type PortfolioMetrics,
} from "./metrics";
import { LANDLORD_RULES } from "./rules";

/** The landlord vertical: the only one today. */
export const landlord = {
  id: "landlord",
  labels: LANDLORD_LABELS,
  library: COMPONENT_LIBRARY,
  defaultLife,
  rules: LANDLORD_RULES,
  derivedMetrics: (g) => landlordMetrics(g.result, g.facts),
  rollupMetrics: portfolioMetrics,
} satisfies Vertical<LibraryComponent, LandlordFacts, LandlordMetrics, PortfolioMetrics>;

// Engine types the app may use, re-exported so app code never imports "@/engine".
export type {
  AtRiskComponent,
  Component,
  EstimateFlags,
  FundingYear,
  LifeStatus,
  PlannedExpense,
  Replacement,
  RiskStatus,
  Scenario,
  ScenarioFigures,
  YearSummary,
} from "@/engine";
export * from "./rules";
export * from "./units";
export * from "./labels";
export * from "./parse";
export * from "./metrics";
export * from "./forecast";
export * from "./property";
export * from "./portfolio";
export * from "./compare";
export * from "./lifespan";
export * from "./mockup";
export * from "./library/components";
export * from "./library/typical-costs";
export * from "./library/typical-cost-sources";
export * from "./library/parse";
export * from "./library/content";
export * from "./library/phrasing";
export * from "./draft/model";
export * from "./draft/ids";
export * from "./draft/rows";
export * from "./draft/import";
export * from "./draft/components";
export * from "./draft/example";
export * from "./reserve-calculator";
export * from "./quick-estimate";
export * from "./condition-report";
export * from "./sample-report";
export * from "./owner-emails";
