import { BALANCE_PROBLEM, readReserveInputs, ROW_PROBLEM, UNITS_PROBLEM, YEAR_TYPED_PROBLEM } from "../inputs";
import { sinkingFund } from "../sinking-fund";

const row = (cost: string, years: string, id = 1) => ({ id, cost, years });

describe("reading the reserve calculator's fields", () => {
  it("reads plain and formatted numbers", () => {
    const r = readReserveInputs([row("$60,000", "5"), row("", "", 2)], "30,000", "12");
    expect(r.expenses).toEqual([{ cost: 60000, yearsUntilDue: 5 }]);
    expect(r).toMatchObject({ balance: 30000, balanceProblem: null, units: 12, unitsProblem: null });
    expect(r.rowProblems.size).toBe(0);
  });

  it("treats blank balance and units as none", () => {
    expect(readReserveInputs([row("1000", "2")], "", "")).toMatchObject({ balance: 0, balanceProblem: null, units: 0, unitsProblem: null });
  });

  it("flags a balance it can't read instead of counting it as nothing", () => {
    for (const bad of ["$30k", "30k", "-5000", "thirty"]) {
      expect(readReserveInputs([row("60000", "5")], bad, "").balanceProblem).toBe(BALANCE_PROBLEM);
    }
  });

  it("flags units that aren't a whole number above 0", () => {
    for (const bad of ["12 units", "0", "2.5", "-3"]) {
      expect(readReserveInputs([row("60000", "5")], "", bad).unitsProblem).toBe(UNITS_PROBLEM);
    }
  });

  it("flags a calendar year typed as years until due", () => {
    expect(readReserveInputs([row("60000", "2031")], "", "").rowProblems.get(1)).toBe(YEAR_TYPED_PROBLEM);
  });

  it("caps years until due at 100", () => {
    expect(readReserveInputs([row("60000", "100")], "", "").expenses).toEqual([{ cost: 60000, yearsUntilDue: 100 }]);
    expect(readReserveInputs([row("60000", "101")], "", "").rowProblems.get(1)).toBe(ROW_PROBLEM);
    expect(readReserveInputs([row("60000", "10000000")], "", "").rowProblems.get(1)).toBe(YEAR_TYPED_PROBLEM);
  });

  it("flags half-filled and unreadable rows", () => {
    const r = readReserveInputs([row("1.4k", "5", 1), row("500", "", 2), row("500", "2.5", 3)], "", "");
    expect([...r.rowProblems.keys()]).toEqual([1, 2, 3]);
    expect(r.expenses).toEqual([]);
  });
});

describe("the $30k balance example from the review", () => {
  it("counts a readable balance and refuses an unreadable one", () => {
    const ok = readReserveInputs([row("60000", "5")], "30,000", "");
    expect(sinkingFund({ expenses: ok.expenses, currentBalance: ok.balance, units: ok.units }).monthly).toBeCloseTo(500);
    expect(readReserveInputs([row("60000", "5")], "$30k", "").balanceProblem).not.toBeNull();
  });
});
