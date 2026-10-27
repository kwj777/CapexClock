import {
  buildingCostOf,
  costBasis,
  parseNumber,
  typicalCostFor,
  type DraftRow,
  type LibraryComponent,
  type TypicalCost,
} from "@/verticals/landlord";
import { formatCostRange } from "./format";

/** Help text under a cost field; `warn` when the typed cost looks like a typo. */
export interface CostHint {
  text: string;
  warn: boolean;
}

/** A cost this many times the typical high or more is questioned: most likely an extra zero. */
export const WELL_ABOVE_TYPICAL = 5;

/**
 * Gray help text under a cost field, from the library item's typical cost, when
 * typicalCostFor finds one that means the same as the field. A cost typed well
 * above it turns the hint into a question about the zeros. A cost for the whole
 * building gets the item's price that doesn't depend on its size (buildingCostOf).
 * The hint is never used in the math.
 */
export function costHint(
  row: Pick<DraftRow, "unitLabel" | "quantity" | "followsUnitCount"> & Partial<Pick<DraftRow, "costEach">>,
  lib: LibraryComponent | undefined,
  typical: TypicalCost | undefined,
): CostHint | null {
  const cost = typicalCostFor(row, lib, typical);
  if (cost) {
    const range = `${formatCostRange(cost.low, cost.high)}${cost.each ? " each" : ""}`;
    const typed = parseNumber(row.costEach ?? "");
    if (typed !== null && cost.high > 0 && typed > cost.high * WELL_ABOVE_TYPICAL) {
      return { text: `Well above the typical ${range}, check the zeros.`, warn: true };
    }
    return { text: `Typical ${range}, use your quote`, warn: false };
  }
  const building = lib && costBasis(row) === "building" ? buildingCostOf(lib.slug, typical) : null;
  if (building) {
    return { text: `Typical ${formatCostRange(building.low, building.high)} ${building.what}, use your quote`, warn: false };
  }
  return null;
}
