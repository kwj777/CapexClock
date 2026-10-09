import { computeForecast } from "..";
import { BUILDING, START } from "./fixtures";

describe("contingency rate", () => {
  const plain = computeForecast({ startYear: START, components: BUILDING });

  it("defaults to 0 and leaves the monthly reserve as it was", () => {
    expect(plain.contingencyRate).toBe(0);
    expect(plain.monthlyReserve).toBeGreaterThan(0);
    expect(plain.monthlyReserveBeforeContingency).toBe(plain.monthlyReserve);
  });

  it("adds the margin on top of the monthly reserve only", () => {
    const padded = computeForecast({ startYear: START, components: BUILDING, contingencyRate: 0.2 });
    expect(padded.contingencyRate).toBe(0.2);
    expect(padded.monthlyReserveBeforeContingency).toBe(plain.monthlyReserve);
    expect(padded.monthlyReserve).toBeCloseTo(plain.monthlyReserve * 1.2, 9);
    expect(padded.neededNow).toBe(plain.neededNow);
    expect(padded.horizonTotal).toBe(plain.horizonTotal);
    expect(padded.years).toEqual(plain.years);
    expect(padded.tightestYear).toBe(plain.tightestYear);
  });

  it("keeps a zero reserve at zero", () => {
    expect(computeForecast({ startYear: START, components: [], contingencyRate: 0.1 }).monthlyReserve).toBe(0);
  });
});
