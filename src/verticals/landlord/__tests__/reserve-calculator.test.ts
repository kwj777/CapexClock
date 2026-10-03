import {
  BALANCE_PROBLEM,
  readReserveInputs,
  reserveCalculator,
  reserveFromExpenses,
  ROW_PROBLEM,
  UNITS_PROBLEM,
  YEAR_TYPED_PROBLEM,
} from "../reserve-calculator";

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
    // The message covers 0, which is a whole number.
    expect(UNITS_PROBLEM).toMatch(/above 0/);
  });

  it("flags a calendar year typed as years until due", () => {
    for (const year of ["2031", "1998", "2199"]) {
      expect(readReserveInputs([row("60000", year)], "", "").rowProblems.get(1)).toEqual({
        message: YEAR_TYPED_PROBLEM,
        fields: ["years"],
      });
    }
  });

  it("caps years until due at 100", () => {
    expect(readReserveInputs([row("60000", "100")], "", "").expenses).toEqual([{ cost: 60000, yearsUntilDue: 100 }]);
    // Too many years, but not a year, so it isn't called one.
    for (const tooMany of ["101", "1899", "2200", "10000000"]) {
      expect(readReserveInputs([row("60000", tooMany)], "", "").rowProblems.get(1)).toEqual({
        message: ROW_PROBLEM,
        fields: ["years"],
      });
    }
  });

  it("flags half-filled and unreadable rows", () => {
    const r = readReserveInputs([row("1.4k", "5", 1), row("500", "", 2), row("500", "2.5", 3)], "", "");
    expect([...r.rowProblems.keys()]).toEqual([1, 2, 3]);
    expect(r.expenses).toEqual([]);
  });

  it("names only the fields that need fixing", () => {
    const r = readReserveInputs(
      [row("1.4k", "5", 1), row("500", "", 2), row("", "3", 3), row("-2", "2.5", 4)],
      "",
      "",
    );
    expect(r.rowProblems.get(1)?.fields).toEqual(["cost"]);
    expect(r.rowProblems.get(2)?.fields).toEqual(["years"]);
    expect(r.rowProblems.get(3)?.fields).toEqual(["cost"]);
    expect(r.rowProblems.get(4)?.fields).toEqual(["cost", "years"]);
  });
});

describe("the $30k balance example from the review", () => {
  it("counts a readable balance and refuses an unreadable one", () => {
    const ok = readReserveInputs([row("60000", "5")], "30,000", "");
    expect(reserveFromExpenses(ok.expenses, ok.balance, ok.units).monthly).toBeCloseTo(500);
    expect(readReserveInputs([row("60000", "5")], "$30k", "").balanceProblem).not.toBeNull();
  });
});

describe("the reserve calculator's figures", () => {
  it("adds the per-unit figure to the engine's plan", () => {
    const r = reserveFromExpenses([{ cost: 12000, yearsUntilDue: 5 }], 0, 4);
    expect(r.monthly).toBeCloseTo(200);
    expect(r.perUnit).toBe(r.monthly / 4);
    expect(r.shortfallNow).toBe(0);
    expect(r.total).toBe(12000);
    expect(r.schedule.map((y) => y.yearsFromStart)).toEqual([1, 2, 3, 4, 5]);
  });

  it("allows a fractional unit count and has no per-unit figure without units", () => {
    expect(reserveFromExpenses([{ cost: 12000, yearsUntilDue: 5 }], 0, 2.5).perUnit).toBeCloseTo(80);
    expect(reserveFromExpenses([{ cost: 12000, yearsUntilDue: 5 }], 0, 0).perUnit).toBeNull();
  });

  it("pays anything due now from the balance and reports the shortfall", () => {
    const r = reserveFromExpenses(
      [
        { cost: 10000, yearsUntilDue: 0 },
        { cost: 12000, yearsUntilDue: 1 },
      ],
      4000,
      2,
    );
    expect(r.shortfallNow).toBe(6000);
    expect(r.monthly).toBeCloseTo(1000);
    expect(r.perUnit).toBeCloseTo(500);
  });
});

describe("when the reserve calculator shows figures", () => {
  it("shows them once there's an expense and nothing to fix", () => {
    const { inputs, result } = reserveCalculator([row("12000", "5")], "", "4");
    expect(inputs.expenses).toEqual([{ cost: 12000, yearsUntilDue: 5 }]);
    expect(result).toEqual(reserveFromExpenses(inputs.expenses, 0, 4));
  });

  it("shows nothing until an expense is entered", () => {
    expect(reserveCalculator([row("", "")], "30000", "12").result).toBeNull();
    expect(reserveCalculator([], "", "").result).toBeNull();
  });

  it("shows nothing while a row or the balance needs fixing", () => {
    expect(reserveCalculator([row("12000", "5"), row("1.4k", "5", 2)], "", "").result).toBeNull();
    expect(reserveCalculator([row("12000", "5")], "$30k", "").result).toBeNull();
  });

  it("still shows the figures with a unit count it can't read, without the per-unit one", () => {
    const { inputs, result } = reserveCalculator([row("12000", "5")], "", "12.5");
    expect(inputs.unitsProblem).toBe(UNITS_PROBLEM);
    expect(result?.monthly).toBeCloseTo(200);
    expect(result?.perUnit).toBeNull();
  });
});
