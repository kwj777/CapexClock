import { computeForecast, fundingSchedule, levelMonthlyReserve, nextReplacementReserve, planExpenses } from "..";
import { BUILDING, component, mulberry32, randomComponents, START } from "./fixtures";

describe("the level monthly reserve", () => {
  it("is the smallest level amount that pays every later bill on time", () => {
    // Roof (2030) and condensers (2033): $90,000 after 7 years of saving.
    const f = computeForecast({ startYear: START, components: BUILDING });
    expect(f.monthlyReserve).toBe(90000 / 84);
    expect(f.tightestYear).toBe(2033);
    expect(f.shortfallNow).toBe(33600);
    expect(f.carriedForward).toBe(0);
  });

  it("does not spread first-year costs into the monthly amount", () => {
    const once = component({ installYear: 1990, usefulLifeYears: 36, replacementCostEach: 5000 }); // 2026, next 2062
    const f = computeForecast({ startYear: START, components: [once] });
    expect(f.neededNow).toBe(5000);
    expect(f.monthlyReserve).toBe(0);
    expect(f.tightestYear).toBeNull();
  });

  it("picks the earliest year when two set the same amount", () => {
    expect(levelMonthlyReserve([0, 1200, 1200])).toEqual({ monthly: 100, tightestIndex: 1, shortfallNow: 0, carriedForward: 0 });
    expect(levelMonthlyReserve([])).toEqual({ monthly: 0, tightestIndex: null, shortfallNow: 0, carriedForward: 0 });
  });

  it("refuses NaN or negative totals and passes Infinity through", () => {
    expect(() => levelMonthlyReserve([0, Number.NaN])).toThrow("Year totals must be amounts of 0 or more.");
    expect(() => levelMonthlyReserve([0, -1])).toThrow("Year totals must be amounts of 0 or more.");
    expect(levelMonthlyReserve([0, Number.POSITIVE_INFINITY]).monthly).toBe(Number.POSITIVE_INFINITY);
  });

  describe("with money already saved", () => {
    const run = (currentReserveBalance: number) => computeForecast({ startYear: START, components: BUILDING, currentReserveBalance });

    it("pays the first-year bill first and reports what it can't cover", () => {
      const f = run(10000);
      expect(f.monthlyReserve).toBe(90000 / 84);
      expect(f.shortfallNow).toBe(23600);
      expect(f.neededNow).toBe(33600);
      expect(f.currentReserveBalance).toBe(10000);
    });

    it("counts what's left toward later bills", () => {
      const f = run(40000);
      expect(f.monthlyReserve).toBe((90000 - 6400) / 84);
      expect(f.shortfallNow).toBe(0);
      expect(f.carriedForward).toBe(6400);
    });

    it("needs nothing monthly once it covers everything", () => {
      const f = run(500000);
      expect(f.monthlyReserve).toBe(0);
      expect(f.tightestYear).toBeNull();
    });

    it("refuses a negative balance", () => {
      expect(() => levelMonthlyReserve([0, 1], -1)).toThrow("Current reserve balance must be a dollar amount of 0 or more.");
    });
  });

  it("never runs short, and a smaller amount would (seeded)", () => {
    const rand = mulberry32(2026);
    for (let i = 0; i < 300; i++) {
      const totals = Array.from({ length: 1 + Math.floor(rand() * 35) }, () => (rand() < 0.5 ? 0 : rand() * 1e5));
      const balance = rand() < 0.5 ? 0 : rand() * 1e5;
      const { monthly, carriedForward } = levelMonthlyReserve(totals, balance);
      let running = carriedForward;
      let shortWithLess = false;
      let lessRunning = carriedForward;
      for (let k = 1; k < totals.length; k++) {
        running += monthly * 12 - totals[k];
        lessRunning += monthly * (1 - 1e-6) * 12 - totals[k];
        expect(running).toBeGreaterThanOrEqual(-1e-6);
        if (lessRunning < -1e-9) shortWithLess = true;
      }
      if (monthly > 0) expect(shortWithLess).toBe(true);
    }
  });
});

describe("planned expenses (lump sums due some years from now)", () => {
  it("spreads a single expense evenly over the months until it's due", () => {
    const p = planExpenses([{ cost: 12000, yearsUntilDue: 5 }]);
    expect(p.monthly).toBe(200);
    expect(p.shortfallNow).toBe(0);
    expect(p.total).toBe(12000);
  });

  it("raises the deposit so an early expense isn't short because of a late one", () => {
    const p = planExpenses([
      { cost: 60000, yearsUntilDue: 2 },
      { cost: 60000, yearsUntilDue: 10 },
    ]);
    expect(p.monthly).toBe(2500);
    expect(p.schedule).toHaveLength(10);
    expect(p.schedule.every((y) => y.endBalance >= -1e-6)).toBe(true);
  });

  it("counts the balance, and pays anything due now from it first", () => {
    expect(planExpenses([{ cost: 12000, yearsUntilDue: 5 }], 6000).monthly).toBe(100);
    const p = planExpenses(
      [
        { cost: 10000, yearsUntilDue: 0 },
        { cost: 12000, yearsUntilDue: 1 },
      ],
      4000,
    );
    expect(p.shortfallNow).toBe(6000);
    expect(p.monthly).toBe(1000);
    expect(p.total).toBe(22000);
  });

  it("needs nothing monthly when the balance covers everything", () => {
    const p = planExpenses([{ cost: 5000, yearsUntilDue: 3 }], 8000);
    expect(p.monthly).toBe(0);
    expect(p.schedule.map((y) => y.endBalance)).toEqual([8000, 8000, 3000]);
  });

  it("finds the tightest point among far-apart years", () => {
    const p = planExpenses([
      { cost: 24000, yearsUntilDue: 2 },
      { cost: 100000, yearsUntilDue: 100 },
    ]);
    expect(p.monthly).toBe(1000);
    expect(p.schedule).toHaveLength(100);
  });

  it("refuses an expense more than 100 years out, even an unusable one", () => {
    expect(() => planExpenses([{ cost: 60000, yearsUntilDue: 1e7 }])).toThrow("Years until due can't be more than 100.");
    expect(() => planExpenses([{ cost: 0, yearsUntilDue: 101 }])).toThrow("Years until due can't be more than 100.");
  });

  it("ignores zero, negative, unreadable and past rows and floors fractional years", () => {
    const p = planExpenses([
      { cost: 0, yearsUntilDue: 2 },
      { cost: -5, yearsUntilDue: 2 },
      { cost: Number.NaN, yearsUntilDue: 2 },
      { cost: 100, yearsUntilDue: Number.NaN },
      { cost: 100, yearsUntilDue: -1 },
    ]);
    expect(p).toEqual({ monthly: 0, shortfallNow: 0, carriedForward: 0, total: 0, schedule: [] });
    expect(planExpenses([{ cost: 1200, yearsUntilDue: 1.9 }]).monthly).toBe(100);
  });

  it("refuses a negative balance", () => {
    expect(() => planExpenses([], -1)).toThrow("Current reserve balance must be a dollar amount of 0 or more.");
  });
});

describe("the funding schedule", () => {
  it("walks the balance year by year, empty years included", () => {
    expect(fundingSchedule([999, 0, 3000], 100, 500)).toEqual([
      { yearsFromStart: 1, deposits: 1200, spent: 0, endBalance: 1700 },
      { yearsFromStart: 2, deposits: 1200, spent: 3000, endBalance: -100 },
    ]);
  });
});

describe("one component's reserve", () => {
  it("saves for the next replacement, with no horizon cap", () => {
    expect(nextReplacementReserve(component({ installYear: 2020, quantity: 12, replacementCostEach: 1400 }), START)).toEqual({
      neededNow: 0,
      monthly: 16800 / 48,
      savingFor: 2030,
    });
    const panel = component({ installYear: 2024, usefulLifeYears: 33, quantity: 12, replacementCostEach: 3000 }); // 2057
    expect(nextReplacementReserve(panel, START)).toEqual({ neededNow: 0, monthly: 36000 / (31 * 12), savingFor: 2057 });
  });

  it("saves for the one after when it's due now, overdue or replaced now", () => {
    expect(nextReplacementReserve(component({ installYear: 2000, usefulLifeYears: 20, replacementCostEach: 24000 }), START)).toEqual({
      neededNow: 24000,
      monthly: 100,
      savingFor: 2046,
    });
    expect(nextReplacementReserve(component({ installYear: 2016 }), START).savingFor).toBe(2036);
    expect(nextReplacementReserve(component({ installYear: 2024, scenario: "replace_now" }), START)).toMatchObject({ neededNow: 1000, savingFor: 2036 });
  });

  it("matches the forecast's reserve for a single installed component inside the horizon", () => {
    // Once installed, no later replacement needs more a month than the next one does.
    // (One installed in the future can: a short life after a long wait.)
    const rand = mulberry32(5);
    let checked = 0;
    for (let i = 0; i < 200; i++) {
      for (const c of randomComponents(rand, START)) {
        const one = nextReplacementReserve(c, START);
        if (c.installYear > START || one.savingFor > START + 30) continue;
        const f = computeForecast({ startYear: START, components: [c] });
        expect(one.neededNow).toBe(f.neededNow);
        expect(Math.abs(one.monthly - f.monthlyReserve)).toBeLessThanOrEqual(1e-12 * Math.max(1, f.monthlyReserve));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it("refuses a bad component, start year or rate", () => {
    expect(() => nextReplacementReserve(component({ quantity: 0 }), START)).toThrow(RangeError);
    expect(() => nextReplacementReserve(component(), 2026.5)).toThrow("Start year must be a whole year.");
    expect(() => nextReplacementReserve(component(), START, { inflationRate: 2 })).toThrow(RangeError);
  });
});
