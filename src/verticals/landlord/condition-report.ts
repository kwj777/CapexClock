// The facts a condition report shows for each component: age, remaining
// life, condition and what's at risk. The sample report (scripts/sample-report.tsx)
// is made from these. Everything comes from what the owner supplied; nothing
// is filled in for them.

import { componentLife, type Component, type LifeStatus } from "@/engine";
import type { ComponentCondition } from "./draft/model";
import { LANDLORD_RULES } from "./rules";
import type { UnitLabel } from "./units";

export interface ReportInput {
  component: Component;
  unitLabel: UnitLabel;
  /** Null when the owner didn't rate it. */
  condition: ComponentCondition | null;
  notes: string;
}

export interface ReportRow {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unitLabel: UnitLabel;
  installYear: number;
  installYearIsEstimate: boolean;
  /** Whole years since it was installed, as of the report's year. */
  age: number;
  usefulLife: number;
  endOfLifeYear: number;
  /** Years left until end of life; negative once it's past. */
  remainingLife: number;
  /** Past end of life, due within LANDLORD_RULES.atRiskYears (both "at risk"), or neither. */
  status: LifeStatus;
  condition: ComponentCondition | null;
  notes: string;
  /** Quantity × cost each, in today's dollars. */
  replacementCost: number;
}

/** One row per component, the ones nearest the end of their life first. */
export function reportRows(inputs: readonly ReportInput[], year: number): ReportRow[] {
  return inputs
    .map(({ component: c, unitLabel, condition, notes }): ReportRow => {
      const life = componentLife(c, year, LANDLORD_RULES.atRiskYears);
      return {
        id: c.id,
        name: c.name,
        category: c.category,
        quantity: c.quantity,
        unitLabel,
        installYear: c.installYear,
        installYearIsEstimate: c.estimated?.installYear ?? false,
        age: life.age,
        usefulLife: c.usefulLifeYears,
        endOfLifeYear: life.endOfLifeYear,
        remainingLife: life.yearsRemaining,
        status: life.status,
        condition,
        notes: notes.trim(),
        replacementCost: life.replacementCost,
      };
    })
    .sort((a, b) => a.remainingLife - b.remainingLife || a.name.localeCompare(b.name));
}

const years = (n: number) => `${n} ${n === 1 ? "year" : "years"}`;

/** "18 years", "Under 1 year", with "(est.)" when the install year is a guess. */
export function ageText(row: Pick<ReportRow, "age" | "installYearIsEstimate">): string {
  const age = row.age === 0 ? "Under 1 year" : years(row.age);
  return row.installYearIsEstimate ? `${age} (est.)` : age;
}

/** "4 years", "Due this year" or "15 years past". */
export function remainingLifeText(remainingLife: number): string {
  if (remainingLife === 0) return "Due this year";
  return remainingLife < 0 ? `${years(-remainingLife)} past` : years(remainingLife);
}

/** "Past end of life", "Due within 2 years" or "" for the at-risk marker. */
export function statusText(status: LifeStatus): string {
  if (status === "overdue") return "Past end of life";
  return status === "due_soon" ? `Due within ${years(LANDLORD_RULES.atRiskYears)}` : "";
}

/** How many components were rated each way, in Good, Fair, Poor order, leaving out unrated ones. */
export function conditionCounts(rows: readonly Pick<ReportRow, "condition">[]): { condition: ComponentCondition; count: number }[] {
  return (["good", "fair", "poor"] as const)
    .map((condition) => ({ condition, count: rows.filter((r) => r.condition === condition).length }))
    .filter((c) => c.count > 0);
}
