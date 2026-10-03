import { AT_RISK_YEARS, componentLife, computeForecast, findAtRisk, lifeStatus } from "..";
import { component, START } from "./fixtures";

describe("the at-risk rule", () => {
  it("is overdue past end of life, due soon within the window, otherwise ok", () => {
    expect(AT_RISK_YEARS).toBe(2);
    expect(lifeStatus(-1)).toBe("overdue");
    expect(lifeStatus(0)).toBe("due_soon");
    expect(lifeStatus(2)).toBe("due_soon");
    expect(lifeStatus(3)).toBe("ok");
    expect(lifeStatus(5, 5)).toBe("due_soon");
    expect(lifeStatus(1, 0)).toBe("ok");
  });

  it("lists overdue and due-soon components, most urgent first", () => {
    const list = findAtRisk(
      [
        component({ id: "soon", name: "Soon", installYear: 2018 }), // 2028: 2 left
        component({ id: "fine", name: "Fine", installYear: 2019 }), // 2029: 3 left
        component({ id: "late", name: "Late", installYear: 2014 }), // 2024: -2
        component({ id: "now", name: "Now", installYear: 2016 }), // 2026: 0
      ],
      START,
    );
    expect(list.map((r) => [r.componentId, r.yearsRemaining, r.status])).toEqual([
      ["late", -2, "overdue"],
      ["now", 0, "due_soon"],
      ["soon", 2, "due_soon"],
    ]);
    expect(list[0]).toEqual({
      componentId: "late",
      name: "Late",
      category: "Plumbing",
      endOfLifeYear: 2024,
      yearsRemaining: -2,
      status: "overdue",
      estimated: { quantity: false, installYear: false, usefulLife: false, replacementCost: false },
    });
  });

  it("keeps input order for ties, whatever the names (no locale)", () => {
    const names = ["Žluté okno", "chodník", "Zahrada", "ch", "Ä", "a"];
    const list = findAtRisk(
      names.map((name, i) => component({ id: `c${i}`, name, installYear: 2015 })),
      START,
    );
    expect(list.map((r) => r.name)).toEqual(names);
  });

  it("takes a window of 0 to 100 years", () => {
    const parts = [component({ id: "a", installYear: 2016 }), component({ id: "b", installYear: 2018 }), component({ id: "c", installYear: 2021 })];
    expect(findAtRisk(parts, START, 0).map((r) => r.componentId)).toEqual(["a"]);
    expect(findAtRisk(parts, START, 5).map((r) => r.componentId)).toEqual(["a", "b", "c"]);
    for (const w of [-1, 1.5, 101, Number.NaN]) {
      expect(() => findAtRisk(parts, START, w)).toThrow("At-risk window must be a whole number of years from 0 to 100.");
    }
    expect(() => findAtRisk(parts, 2026.5)).toThrow("Current year must be a whole year.");
  });

  it("ignores the scenario, and carries the estimate flags", () => {
    const list = findAtRisk(
      [
        component({ id: "now", installYear: 2010, scenario: "replace_now", estimated: { installYear: true } }),
        component({ id: "later", installYear: 2024, scenario: "replace_now" }),
      ],
      START,
    );
    expect(list.map((r) => r.componentId)).toEqual(["now"]);
    expect(list[0].estimated).toEqual({ quantity: false, installYear: true, usefulLife: false, replacementCost: false });
  });

  it("refuses an invalid component", () => {
    expect(() => findAtRisk([component({ quantity: -5, installYear: 2000 })], START)).toThrow(RangeError);
  });

  it("is the forecast's at-risk list, with the window option", () => {
    const parts = [component({ id: "a", installYear: 2016 }), component({ id: "b", installYear: 2018 }), component({ id: "c", installYear: 2021 })];
    for (const atRiskYears of [0, 2, 5]) {
      expect(computeForecast({ startYear: START, components: parts, atRiskYears }).atRisk).toEqual(findAtRisk(parts, START, atRiskYears));
    }
    expect(computeForecast({ startYear: START, components: parts }).atRisk).toEqual(findAtRisk(parts, START));
  });
});

describe("one component's life", () => {
  it("gives age, end of life, years left, status and cost", () => {
    expect(componentLife(component({ installYear: 2014, quantity: 24, replacementCostEach: 1400 }), START)).toEqual({
      componentId: "c1",
      age: 12,
      endOfLifeYear: 2024,
      yearsRemaining: -2,
      status: "overdue",
      replacementCost: 33600,
    });
    expect(componentLife(component({ installYear: 2030 }), START)).toMatchObject({ age: 0, yearsRemaining: 14, status: "ok" });
    expect(componentLife(component({ installYear: 2021 }), START, 5).status).toBe("due_soon");
  });

  it("refuses a bad component, year or window", () => {
    expect(() => componentLife(component({ usefulLifeYears: 0 }), START)).toThrow(RangeError);
    expect(() => componentLife(component(), Number.NaN)).toThrow("Current year must be a whole year.");
    expect(() => componentLife(component(), START, -1)).toThrow("At-risk window must be a whole number of years from 0 to 100.");
  });
});
