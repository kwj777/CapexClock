import { computeForecast, forecastAssetGroups, rollupForecasts } from "..";
import type { AssetGroup } from "..";
import { BUILDING, component, START } from "./fixtures";

const GROUPS: AssetGroup[] = [
  { id: "g1", name: "First", components: BUILDING },
  { id: "g2", name: "Second", components: [component({ installYear: 2015 })], currentReserveBalance: 400 },
  { id: "g3", name: "Empty", components: [] },
];

describe("forecasting several groups", () => {
  it("forecasts each group with the shared options, in order", () => {
    const out = forecastAssetGroups(GROUPS, { startYear: START, horizonYears: 5 });
    expect(out.map((g) => g.group)).toEqual(GROUPS);
    expect(out[0].result).toEqual(computeForecast({ startYear: START, horizonYears: 5, components: BUILDING }));
    expect(out[2].result.monthlyReserve).toBe(0);
  });

  it("uses a group's own balance over the options' balance", () => {
    const out = forecastAssetGroups(GROUPS, { startYear: START, currentReserveBalance: 100 });
    expect(out.map((g) => g.result.currentReserveBalance)).toEqual([100, 400, 100]);
    expect(out[1].result.shortfallNow).toBe(600);
  });

  it("uses a group's own contingency rate over the options' rate", () => {
    const groups = [GROUPS[0], { ...GROUPS[0], id: "g4", contingencyRate: 0.2 }];
    const out = forecastAssetGroups(groups, { startYear: START, contingencyRate: 0.1 });
    expect(out.map((g) => g.result.contingencyRate)).toEqual([0.1, 0.2]);
    expect(out[1].result.monthlyReserveBeforeContingency).toBe(out[0].result.monthlyReserveBeforeContingency);
  });

  it("sums forecasts in the order given", () => {
    const results = forecastAssetGroups(GROUPS, { startYear: START }).map((g) => g.result);
    const totals = rollupForecasts(results);
    expect(totals).toEqual({
      monthlyReserve: results[0].monthlyReserve + results[1].monthlyReserve + results[2].monthlyReserve,
      neededNow: 33600 + 1000,
      horizonTotal: results[0].horizonTotal + results[1].horizonTotal,
      shortfallNow: 33600 + 600,
      atRiskCount: results[0].atRisk.length + 1,
    });
    expect(rollupForecasts([])).toEqual({ monthlyReserve: 0, neededNow: 0, horizonTotal: 0, shortfallNow: 0, atRiskCount: 0 });
  });

  it("keeps the sum's order, so the float result is the same as a loop", () => {
    const tiny = { ...computeForecast({ startYear: START, components: [] }), monthlyReserve: 0.1 };
    const big = { ...tiny, monthlyReserve: 1e16 };
    expect(rollupForecasts([tiny, big, tiny]).monthlyReserve).toBe(0 + 0.1 + 1e16 + 0.1);
  });
});
