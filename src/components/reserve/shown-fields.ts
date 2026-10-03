import type { ExpenseField, ExpenseRowProblem } from "@/verticals/landlord";

/**
 * The fields to mark as wrong right now. A field is only checked once the owner
 * has left it, so typing a cost doesn't flag the years they haven't reached yet.
 */
export function shownFields(problem: ExpenseRowProblem | undefined, touched: ReadonlySet<ExpenseField>): ExpenseField[] {
  return problem ? problem.fields.filter((f) => touched.has(f)) : [];
}
