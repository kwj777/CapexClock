// What the automatic member emails say, worked out from saved properties. The
// sender (src/lib/owner-emails) only formats and sends what these return.

import type { Component } from "@/engine";
import { reportRows, type ReportRow } from "./condition-report";
import type { ComponentCondition } from "./draft/model";
import { landlordForecast, type LandlordForecast } from "./forecast";
import { safetyBufferOf } from "./rules";
import { summarizePortfolio, type PropertySummary } from "./portfolio";
import { assetGroupFromSaved, type LeftOutComponent, type SavedComponent, type SavedProperty } from "./property";
import type { UnitLabel } from "./units";

/** One component in a replacement reminder. */
export interface ReminderItem {
  readonly propertyId: string;
  readonly propertyName: string;
  readonly componentId: string;
  readonly name: string;
  readonly category: string;
  /** Quantity × cost each, in today's dollars. Null when the owner hasn't entered a cost. */
  readonly cost: number | null;
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
 * the forecast leaves out only for want of a cost are included with a null cost, so
 * the owner hears about them too; rows with no install year can't be dated and aren't.
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
  const categories = new Map(components.map((c) => [c.id, c.category]));
  return summaries.flatMap(({ property, forecast, leftOut }) =>
    [
      ...forecast.years[0].replacements.map(
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
      ),
      ...leftOut
        .filter((c) => c.missing === "cost" && c.endOfLifeYear !== null && (c.endOfLifeYear <= year || c.replaceNow))
        .map(
          (c): ReminderItem => ({
            propertyId: property.id,
            propertyName: property.name,
            componentId: c.componentId,
            name: c.name,
            category: categories.get(c.componentId) ?? "",
            cost: null,
            overdue: c.endOfLifeYear! < year,
            replaceNow: c.replaceNow,
          }),
        ),
    ]
      .filter((r) => !alreadySent.has(reminderKey(r.componentId, year)))
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
  /** Replacements after the 10 years that the monthly reserve is already saving for. */
  readonly savingAhead: readonly { readonly name: string; readonly year: number; readonly cost: number }[];
  /** The site's "never run short" monthly reserve, unrounded. */
  readonly monthlyReserve: number;
  readonly monthlyReservePerUnit: number | null;
  /** Past end of life or due within 2 years, as of the budget year. */
  readonly atRiskCount: number;
  /** Components left out of the numbers (no cost or no install year). */
  readonly excluded: number;
  /** The rows behind `excluded`, so the email can name them. */
  readonly leftOut: readonly LeftOutComponent[];
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
    savingAhead: f.savingAhead.map((r) => ({ name: r.name, year: r.year, cost: r.baseCost })),
    monthlyReserve: f.monthlyReserve,
    monthlyReservePerUnit: f.monthlyReservePerUnit,
    atRiskCount: f.atRisk.length,
    excluded: s.excluded,
    leftOut: s.leftOut,
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
      monthlyReserve: totals.monthlyRoundedUp,
      atRiskCount: totals.atRisk,
    },
  };
}

/** A saved component with what the condition report also shows. The database's ComponentRow fits it. */
export interface SavedReportComponent extends SavedComponent {
  readonly unit_label: UnitLabel;
  readonly condition: ComponentCondition | null;
  readonly notes: string | null;
}

/** What ConditionReportPdf needs for one saved property. */
export interface SavedConditionReport {
  readonly propertyName: string;
  readonly unitCount: number;
  readonly yearBuilt: number | null;
  readonly rows: ReportRow[];
  readonly forecast: LandlordForecast;
  readonly components: readonly Component[];
  /** Components left out (no cost or no install year). */
  readonly excluded: number;
  /** The rows behind `excluded`, which the report names but leaves out of its totals. */
  readonly leftOut: readonly LeftOutComponent[];
  /** Components in the report with no condition rating. */
  readonly unrated: number;
}

/**
 * A saved property's condition report as of `year`, or null when none of its
 * components can be reported on (each needs a cost and an install year).
 */
export function savedConditionReport(
  property: SavedProperty,
  rows: readonly SavedReportComponent[],
  year: number,
): SavedConditionReport | null {
  const { group, excluded, leftOut } = assetGroupFromSaved(property, rows);
  if (group.components.length === 0) return null;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const inputs = group.components.map((component) => {
    const row = byId.get(component.id)!;
    return { component, unitLabel: row.unit_label, condition: row.condition, notes: row.notes ?? "" };
  });
  const report = reportRows(inputs, year);
  return {
    propertyName: property.name,
    unitCount: property.unit_count,
    yearBuilt: property.year_built,
    rows: report,
    forecast: landlordForecast(group.components, property.unit_count, year, safetyBufferOf(property.safety_buffer)),
    components: group.components,
    excluded,
    leftOut,
    unrated: report.filter((r) => r.condition === null).length,
  };
}
