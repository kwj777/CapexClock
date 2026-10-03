import { compareScenarios, computeForecast, projectReplacements, summarizeForecast, withScenario } from "..";
import { BUILDING, component, START } from "./fixtures";

describe("comparing two scenarios", () => {
  const roofNow = withScenario(BUILDING, new Set(["roof"]), "replace_now");

  it("sets the scenario on the chosen components only, without changing the input", () => {
    expect(roofNow.map((c) => c.scenario)).toEqual(["replace_now", undefined, undefined]);
    expect(BUILDING[0].scenario).toBeUndefined();
    expect(roofNow[1]).toBe(BUILDING[1]);
    expect(withScenario(roofNow, new Set(["roof"]), "run_to_failure")[0].scenario).toBe("run_to_failure");
  });

  it("puts replace now against run to failure, difference = modified − base", () => {
    const c = compareScenarios({ startYear: START, components: BUILDING }, { startYear: START, components: roofNow });
    expect(c.base.neededNow).toBe(33600);
    expect(c.modified.neededNow).toBe(69600);
    expect(c.difference).toEqual({
      neededNow: c.modified.neededNow - c.base.neededNow,
      horizonTotal: c.modified.horizonTotal - c.base.horizonTotal,
      monthlyReserve: c.modified.monthlyReserve - c.base.monthlyReserve,
      shortfallNow: c.modified.shortfallNow - c.base.shortfallNow,
    });
    expect(c.difference.neededNow).toBe(36000);
    // Base and modified are summaries: no at-risk list or next replacements.
    expect("atRisk" in c.base).toBe(false);
  });

  it("matches two separate summaries", () => {
    const base = { startYear: START, components: BUILDING };
    const modified = { startYear: START, components: roofNow };
    const c = compareScenarios(base, modified);
    expect(c.base).toEqual(summarizeForecast(projectReplacements(base), base));
    expect(c.modified).toEqual(summarizeForecast(projectReplacements(modified), modified));
    expect(c.modified.monthlyReserve).toBe(computeForecast(modified).monthlyReserve);
  });

  it("can put adjustments or a balance on one side only", () => {
    const c = compareScenarios(
      { startYear: START, components: BUILDING },
      { startYear: START, components: BUILDING, adjustments: [{ year: 2027, amount: 5000 }], currentReserveBalance: 1000 },
    );
    expect(c.difference.horizonTotal).toBe(5000);
    expect(c.difference.neededNow).toBe(0);
    expect(c.difference.shortfallNow).toBe(-1000);
    expect(c.base.years[1].adjustment).toBe(0);
    expect(c.modified.years[1].adjustment).toBe(5000);
  });

  it("refuses scenarios with a different start year or window", () => {
    const parts = [component()];
    expect(() => compareScenarios({ startYear: START, components: parts }, { startYear: START + 1, components: parts })).toThrow(
      "Scenarios must have the same start year and window.",
    );
    expect(() =>
      compareScenarios({ startYear: START, components: parts }, { startYear: START, components: parts, horizonYears: 5 }),
    ).toThrow("Scenarios must have the same start year and window.");
  });
});
