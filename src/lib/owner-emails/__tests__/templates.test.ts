import { budgetSummaryEmail } from "../templates";
import type { BudgetSummary } from "@/verticals/landlord";

const footer = { kind: "budget_summary" as const, unsubscribeUrl: "https://capexclock.com/email/unsubscribe?t=x" };

function summary(budgetYearTotal: number): BudgetSummary {
  return {
    budgetYear: 2027,
    properties: [
      {
        propertyId: "p1",
        name: "14 Maple",
        unitCount: 2,
        budgetYearTotal,
        budgetYearItems: budgetYearTotal ? [{ name: "Roof", cost: budgetYearTotal, overdue: false }] : [],
        tenYearTotal: 42_000,
        monthlyReserve: 350,
        monthlyReservePerUnit: 175,
        atRiskCount: 0,
        excluded: 0,
        componentCount: budgetYearTotal ? 1 : 0,
      },
    ],
    totals: { budgetYearTotal, tenYearTotal: 42_000, monthlyReserve: 350, atRiskCount: 0 },
  };
}

describe("budgetSummaryEmail", () => {
  it("puts next year's total in the subject", () => {
    const email = budgetSummaryEmail(summary(9_000), footer);
    expect(email.subject).toBe("Your 2027 replacement budget: $9,000");
    expect(email.text).toContain("In 2027, plan on $9,000 for replacements across your property, and $42,000 over the next 10 years.");
  });

  it("says nothing is due instead of a $0 budget", () => {
    const email = budgetSummaryEmail(summary(0), footer);
    expect(email.subject).toBe("Nothing to replace in 2027");
    expect(email.text).toContain(
      "Nothing across your property is due for replacement in 2027. Over the next 10 years, plan on $42,000.",
    );
    expect(email.text).not.toContain("plan on $0");
  });
});
