// FROZEN COPY of the rule in src/components/reserve/ReserveCalculator.tsx (lines 60
// and 68-70) at commit 94acb55 (main) that decides when the reserve calculator shows a
// result, copied out of the component so it can be pinned. Do not edit: the
// "Today's numbers unchanged" check fails on any change here.

import { readReserveInputs, type ExpenseFields } from "./inputs";
import { sinkingFund } from "./sinking-fund";

/** What the page computes from its fields on each render: the read inputs, and the result or null. */
export function legacyReserveCalculator(rows: ExpenseFields[], balance: string, units: string) {
  const inputs = readReserveInputs(rows, balance, units);
  const problems = inputs.rowProblems;
  const result = inputs.expenses.length && problems.size === 0 && !inputs.balanceProblem
    ? sinkingFund({ expenses: inputs.expenses, currentBalance: inputs.balance, units: inputs.units })
    : null;
  return { inputs, result };
}
