import { formatMoney } from "@/components/calculator/format";
import { roundEstimate, type QuickEstimate, type QuickInputs } from "@/lib/reserve/quick-estimate";

export const ENTER_PROMPT = "Enter your units and year built to see an estimate.";
export const FIX_PROMPT = "Fix the highlighted fields to see an estimate.";
export const TICK_PROMPT = "Tick at least one system to see an estimate.";

/**
 * What shows in place of the estimate. "Fix" only when a field is marked: a year
 * built is only marked once the owner leaves it, so while it's being typed this
 * still asks for it.
 */
export function quickPrompt(inputs: QuickInputs, yearProblemShown: boolean): string {
  if (inputs.unitsProblem !== null || yearProblemShown) return FIX_PROMPT;
  if (inputs.units === null || inputs.yearBuilt === null) return ENTER_PROMPT;
  return TICK_PROMPT;
}

export interface EstimateText {
  /** "$175–$380" */
  perUnit: string;
  /** The same range for the whole building. */
  building: string;
  /** What screen readers hear once typing pauses. */
  spoken: string;
}

function range(low: number, high: number, between: string): string {
  return low === high ? formatMoney(low) : `${formatMoney(low)}${between}${formatMoney(high)}`;
}

/**
 * The estimate as shown: each end rounded up (to the next $5), and the building's
 * figure from the rounded per-unit one, so the two always multiply out.
 */
export function estimateText(estimate: QuickEstimate, units: number): EstimateText {
  const low = roundEstimate(estimate.perUnit.low);
  const high = roundEstimate(estimate.perUnit.high);
  return {
    perUnit: range(low, high, "–"),
    building: range(low * units, high * units, "–"),
    spoken: `About ${range(low, high, " to ")} per unit each month, or ${range(low * units, high * units, " to ")} for the building, from typical costs.`,
  };
}
