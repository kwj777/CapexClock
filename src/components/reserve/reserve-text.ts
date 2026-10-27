import { formatMoney, formatReserve } from "@/components/calculator/format";
import type { ReserveCalculatorResult } from "@/verticals/landlord";

/**
 * The line under the expense list's figures: why the monthly amount is what it
 * is, what $0 means, and what to do about a gap now.
 */
export function explainResult(result: ReserveCalculatorResult): string {
  if (result.monthly <= 0) {
    return result.shortfallNow > 0
      ? `You need ${formatMoney(result.shortfallNow)} now to cover what's due. Nothing else is coming up, so there's no monthly amount to save after that.`
      : "Your current balance already covers everything you listed.";
  }
  const gap =
    result.shortfallNow > 0
      ? " Your balance doesn't cover what's due now, so cover that gap from other money now. The monthly amount is on top of it."
      : "";
  const { setBy } = result;
  if (setBy) {
    const years = setBy.years === 1 ? "1 year" : `${setBy.years} years`;
    const due = `${formatMoney(setBy.cost)} due ${setBy.spread ? `over the next ${years}` : `in ${years}`}`;
    return `Set by the ${due}: save this much until then to have it ready on time, counting your current balance. Once that's paid you'll need less, about ${formatReserve(setBy.after)} a month for the rest, so run this again then.${gap}`;
  }
  return `This is the smallest steady monthly amount that has the cash ready for every expense on time, starting from your current balance.${gap}`;
}
