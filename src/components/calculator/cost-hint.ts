import { typicalCostFor, type DraftRow, type LibraryComponent, type TypicalCost } from "@/verticals/landlord";
import { formatCostRange } from "./format";

/**
 * Gray help text under a cost field, from the library item's typical cost, when
 * typicalCostFor finds one that means the same as the field. The hint is never
 * used in the math.
 */
export function costHint(
  row: Pick<DraftRow, "unitLabel" | "quantity" | "followsUnitCount">,
  lib: LibraryComponent | undefined,
  typical: TypicalCost | undefined,
): string | null {
  const cost = typicalCostFor(row, lib, typical);
  return cost ? `Typical ${formatCostRange(cost.low, cost.high)}, use your quote` : null;
}
