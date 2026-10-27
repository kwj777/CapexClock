import { reserveFromExpenses } from "@/verticals/landlord";
import { explainResult } from "../reserve-text";

describe("the line under the expense list's figures", () => {
  it("names the early expense that sets the amount, and what's needed after it", () => {
    const text = explainResult(reserveFromExpenses([{ cost: 40000, yearsUntilDue: 2 }, { cost: 10000, yearsUntilDue: 20 }], 5000, 0));
    expect(text).toContain("Set by the $40,000 due in 2 years");
    expect(text).toContain("about $47 a month for the rest");
    expect(text).not.toContain("steady");
  });

  it("explains $0 with a gap now", () => {
    expect(explainResult(reserveFromExpenses([{ cost: 40000, yearsUntilDue: 0 }], 0, 0))).toBe(
      "You need $40,000 now to cover what's due. Nothing else is coming up, so there's no monthly amount to save after that.",
    );
  });

  it("says when the balance already covers everything", () => {
    expect(explainResult(reserveFromExpenses([{ cost: 4000, yearsUntilDue: 3 }], 5000, 0))).toBe(
      "Your current balance already covers everything you listed.",
    );
  });

  it("says how to cover a gap now on top of a monthly amount", () => {
    const text = explainResult(reserveFromExpenses([{ cost: 10000, yearsUntilDue: 0 }, { cost: 12000, yearsUntilDue: 5 }], 0, 0));
    expect(text).toContain("smallest steady monthly amount");
    expect(text).toContain("cover that gap from other money now. The monthly amount is on top of it.");
    expect(text).not.toContain("funded separately");
  });
});
