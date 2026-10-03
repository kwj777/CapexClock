import { assertStartYear, assertValidComponent } from "./validate";
import type { Component, EstimateFlags } from "./types";

/** installYear + usefulLifeYears. */
export function endOfLifeYear(component: Pick<Component, "installYear" | "usefulLifeYears">): number {
  return component.installYear + component.usefulLifeYears;
}

/** quantity × replacementCostEach, unrounded, in start-year dollars. */
export function replacementCost(component: Pick<Component, "quantity" | "replacementCostEach">): number {
  return component.quantity * component.replacementCostEach;
}

/** Every flag spelled out, missing ones false. */
export function estimateFlags(component: Component): EstimateFlags {
  const e = component.estimated;
  return {
    quantity: e?.quantity ?? false,
    installYear: e?.installYear ?? false,
    usefulLife: e?.usefulLife ?? false,
    replacementCost: e?.replacementCost ?? false,
  };
}

/** True when any input of the component is an estimate. */
export function isEstimate(component: Component): boolean {
  const f = estimateFlags(component);
  return f.quantity || f.installYear || f.usefulLife || f.replacementCost;
}

/** Unchecked: callers have validated. */
export function firstReplacementYear(component: Component, startYear: number): number {
  return component.scenario === "replace_now" ? startYear : Math.max(endOfLifeYear(component), startYear);
}

/**
 * The first year on or after startYear the component is replaced: startYear for
 * "replace_now", otherwise end of life, or startYear once that has passed.
 */
export function nextReplacementYear(component: Component, startYear: number): number {
  assertValidComponent(component);
  assertStartYear(startYear);
  return firstReplacementYear(component, startYear);
}

/** Growth factor for costs `yearsAfterStart` years after the start year. Exactly 1 when rate is 0. */
export function inflationFactor(rate: number, yearsAfterStart: number): number {
  return Math.pow(1 + rate, yearsAfterStart);
}
