import {
  BALANCE_PROBLEM,
  readReserveInputs,
  ROW_PROBLEM,
  shownFields,
  UNITS_PROBLEM,
  YEAR_TYPED_PROBLEM,
} from "../inputs";
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

describe("when a row's problem shows", () => {
  it("waits until the owner has left the field that needs fixing", () => {
    const halfDone = readReserveInputs([row("60000", "")], "", "").rowProblems.get(1);
    // Typing a cost, then moving on to the years field: nothing flagged yet.
    expect(shownFields(halfDone, new Set(["cost"]))).toEqual([]);
    // Leaving the years blank flags the years field only.
    expect(shownFields(halfDone, new Set(["cost", "years"]))).toEqual(["years"]);
  });

  it("flags only the unreadable field", () => {
    const badCost = readReserveInputs([row("1.4k", "5")], "", "").rowProblems.get(1);
    expect(shownFields(badCost, new Set(["cost", "years"]))).toEqual(["cost"]);
    expect(shownFields(undefined, new Set(["cost", "years"]))).toEqual([]);
  });
});

describe("the $30k balance example from the review", () => {
  it("counts a readable balance and refuses an unreadable one", () => {
    const ok = readReserveInputs([row("60000", "5")], "30,000", "");
    expect(sinkingFund({ expenses: ok.expenses, currentBalance: ok.balance, units: ok.units }).monthly).toBeCloseTo(500);
    expect(readReserveInputs([row("60000", "5")], "$30k", "").balanceProblem).not.toBeNull();
  });
});
