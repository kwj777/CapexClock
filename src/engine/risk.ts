import { endOfLifeYear, estimateFlags, replacementCost } from "./component";
import { AT_RISK_YEARS } from "./constants";
import { assertAtRiskYears, assertValidComponent } from "./validate";
import type { AtRiskComponent, Component, ComponentLife, LifeStatus } from "./types";

function assertYearAndWindow(currentYear: number, windowYears: number): void {
  if (!Number.isInteger(currentYear)) throw new RangeError("Current year must be a whole year.");
  assertAtRiskYears(windowYears);
}

/** "overdue" when yearsRemaining < 0, "due_soon" when 0..windowYears, else "ok". */
export function lifeStatus(yearsRemaining: number, windowYears: number = AT_RISK_YEARS): LifeStatus {
  if (yearsRemaining < 0) return "overdue";
  return yearsRemaining <= windowYears ? "due_soon" : "ok";
}

/** Age, end of life, years left, status and cost for one component as of `currentYear`. */
export function componentLife(
  component: Component,
  currentYear: number,
  windowYears: number = AT_RISK_YEARS,
): ComponentLife {
  assertValidComponent(component);
  assertYearAndWindow(currentYear, windowYears);
  const eol = endOfLifeYear(component);
  return {
    componentId: component.id,
    age: Math.max(0, currentYear - component.installYear),
    endOfLifeYear: eol,
    yearsRemaining: eol - currentYear,
    status: lifeStatus(eol - currentYear, windowYears),
    replacementCost: replacementCost(component),
  };
}

/**
 * Components past end of life, or within windowYears of it, as of currentYear.
 * Most urgent first; ties keep component input order. Ignores scenario.
 */
export function findAtRisk(
  components: readonly Component[],
  currentYear: number,
  windowYears: number = AT_RISK_YEARS,
): AtRiskComponent[] {
  assertYearAndWindow(currentYear, windowYears);
  const out: AtRiskComponent[] = [];
  for (const c of components) {
    assertValidComponent(c);
    const eol = endOfLifeYear(c);
    const yearsRemaining = eol - currentYear;
    const status = lifeStatus(yearsRemaining, windowYears);
    if (status === "ok") continue;
    out.push({
      componentId: c.id,
      name: c.name,
      category: c.category,
      endOfLifeYear: eol,
      yearsRemaining,
      status,
      estimated: estimateFlags(c),
    });
  }
  // Stable sort: most urgent first, ties keep component input order. No locale-dependent
  // comparison in the engine; a vertical orders names for display.
  return out.sort((a, b) => a.yearsRemaining - b.yearsRemaining);
}
