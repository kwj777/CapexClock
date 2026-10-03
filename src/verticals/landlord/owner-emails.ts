// What the automatic member emails say, worked out from saved properties. The
// sender (src/lib/owner-emails) only formats and sends what these return.

import { summarizePortfolio, type PropertySummary } from "./portfolio";
import type { SavedComponent, SavedProperty } from "./property";

/** One component in a replacement reminder. */
export interface ReminderItem {
  readonly propertyId: string;
  readonly propertyName: string;
  readonly componentId: string;
  readonly name: string;
  readonly category: string;
  /** Quantity × cost each, in today's dollars. */
  readonly cost: number;
  /** End of life was before this year: it's still waiting to be replaced. */
  readonly overdue: boolean;
  /** The owner chose "Replace now" for it. */
  readonly replaceNow: boolean;
}

/** The log key for a reminder: one per component per year it's due. */
export function reminderKey(componentId: string, year: number): string {
  return `${componentId}:${year}`;
}

/**
 * The components due for replacement in `year` (past end of life, ending this year,
 * or marked "Replace now") that haven't been reminded about for this year yet. Rows
 * the forecast leaves out (no cost or no install year) aren't reminded about either.
 * Ordered by property, then overdue first, then by name.
 */
export function remindersDue(
  properties: readonly SavedProperty[],
  components: readonly SavedComponent[],
  year: number,
  alreadySent: ReadonlySet<string>,
): ReminderItem[] {
  const replaceNow = new Set(components.filter((c) => c.scenario === "replace_now").map((c) => c.id));
  const { summaries } = summarizePortfolio(properties, components, year);
  return summaries.flatMap(({ property, forecast }) =>
    forecast.years[0].replacements
      .filter((r) => !alreadySent.has(reminderKey(r.componentId, year)))
      .map(
        (r): ReminderItem => ({
          propertyId: property.id,
          propertyName: property.name,
          componentId: r.componentId,
          name: r.name,
          category: r.category,
          cost: r.baseCost,
          overdue: r.overdue,
          replaceNow: replaceNow.has(r.componentId),
        }),
      )
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.name.localeCompare(b.name, "en-US")),
  );
}

/** One property in the yearly budget summary. */
export interface BudgetProperty {
  readonly propertyId: string;
  readonly name: string;
  readonly unitCount: number;
  /** Replacements expected in the budget year, overdue ones included. Today's dollars. */
  readonly budgetYearTotal: number;
  readonly budgetYearItems: readonly { readonly name: string; readonly cost: number; readonly overdue: boolean }[];
  /** The 10 years from the budget year on. */
  readonly tenYearTotal: number;
  /** The site's "never run short" monthly reserve, unrounded. */
  readonly monthlyReserve: number;
  readonly monthlyReservePerUnit: number | null;
  /** Past end of life or due within 2 years, as of the budget year. */
  readonly atRiskCount: number;
  /** Components left out of the numbers (no cost or no install year). */
  readonly excluded: number;
  readonly componentCount: number;
}

export interface BudgetSummary {
  /** The year being budgeted for: the year after the one the email goes out in. */
  readonly budgetYear: number;
  readonly properties: readonly BudgetProperty[];
  readonly totals: {
    readonly budgetYearTotal: number;
    readonly tenYearTotal: number;
    readonly monthlyReserve: number;
    readonly atRiskCount: number;
  };
}

function budgetProperty(s: PropertySummary<SavedProperty>): BudgetProperty {
  const f = s.forecast;
  return {
    propertyId: s.property.id,
    name: s.property.name,
    unitCount: s.property.unit_count,
    budgetYearTotal: f.neededNow,
    budgetYearItems: f.years[0].replacements
      .map((r) => ({ name: r.name, cost: r.baseCost, overdue: r.overdue }))
      .sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name, "en-US")),
    tenYearTotal: f.horizonTotal,
    monthlyReserve: f.monthlyReserve,
    monthlyReservePerUnit: f.monthlyReservePerUnit,
    atRiskCount: f.atRisk.length,
    excluded: s.excluded,
    componentCount: s.componentCount,
  };
}

/**
 * The yearly budget summary for `budgetYear`: each property's forecast as if that
 * year had started, so anything still overdue counts in it, as on the site.
 */
export function budgetSummary(
  properties: readonly SavedProperty[],
  components: readonly SavedComponent[],
  budgetYear: number,
): BudgetSummary {
  const { summaries, totals } = summarizePortfolio(properties, components, budgetYear);
  const rows = summaries.map(budgetProperty);
  return {
    budgetYear,
    properties: rows,
    totals: {
      budgetYearTotal: totals.neededNow,
      tenYearTotal: rows.reduce((sum, p) => sum + p.tenYearTotal, 0),
      monthlyReserve: totals.monthly,
      atRiskCount: totals.atRisk,
    },
  };
}
