import { sinkingFund } from "../sinking-fund";

describe("sinkingFund", () => {
  it("spreads a single expense evenly over the months until it's due", () => {
    const r = sinkingFund({ expenses: [{ cost: 12000, yearsUntilDue: 5 }], currentBalance: 0, units: 4 });
    expect(r.monthly).toBeCloseTo(200);
    expect(r.perUnit).toBeCloseTo(50);
    expect(r.shortfallNow).toBe(0);
  });

  it("raises the deposit so an early expense isn't underfunded by a late one", () => {
    // Averaging the total over 10 years (1,000/mo) would leave year 2 short.
    const r = sinkingFund({
      expenses: [
        { cost: 60000, yearsUntilDue: 2 },
        { cost: 60000, yearsUntilDue: 10 },
      ],
      currentBalance: 0,
      units: 10,
    });
    expect(r.monthly).toBeCloseTo(2500);
    expect(r.schedule.every((y) => y.endBalance >= -1e-6)).toBe(true);
  });

  it("counts the current balance toward future expenses", () => {
    const r = sinkingFund({ expenses: [{ cost: 12000, yearsUntilDue: 5 }], currentBalance: 6000, units: 1 });
    expect(r.monthly).toBeCloseTo(100);
  });

  it("needs nothing monthly when the balance already covers everything", () => {
    const r = sinkingFund({ expenses: [{ cost: 5000, yearsUntilDue: 3 }], currentBalance: 8000, units: 1 });
    expect(r.monthly).toBe(0);
    expect(r.schedule.at(-1)?.endBalance).toBe(3000);
  });

  it("pays anything due now from the balance and reports the shortfall", () => {
    const r = sinkingFund({
      expenses: [
        { cost: 10000, yearsUntilDue: 0 },
        { cost: 12000, yearsUntilDue: 1 },
      ],
      currentBalance: 4000,
      units: 2,
    });
    expect(r.shortfallNow).toBe(6000);
    expect(r.monthly).toBeCloseTo(1000);
  });

  it("ignores blank, zero and negative rows and handles zero units", () => {
    const r = sinkingFund({
      expenses: [
        { cost: 0, yearsUntilDue: 2 },
        { cost: -5, yearsUntilDue: 2 },
        { cost: Number.NaN, yearsUntilDue: 2 },
      ],
      currentBalance: 0,
      units: 0,
    });
    expect(r.monthly).toBe(0);
    expect(r.perUnit).toBeNull();
    expect(r.total).toBe(0);
    expect(r.schedule).toEqual([]);
  });
});
