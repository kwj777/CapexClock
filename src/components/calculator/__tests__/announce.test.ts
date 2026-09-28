import { computeForecast, type ForecastComponent } from "@/lib/forecast";
import { forecastSummary } from "../announce";

const roof: ForecastComponent = {
  id: "roof",
  category: "Roofing",
  name: "Roof",
  quantity: 1,
  installYear: 2008,
  usefulLifeYears: 22,
  replacementCostEach: 36000,
};

describe("the screen reader summary", () => {
  it("gives the monthly reserve, per unit and what's needed now, rounded like the screen", () => {
    const f = computeForecast({ startYear: 2026, unitCount: 12, components: [roof] });
    // $36,000 due in 2030, four years of deposits: $750 a month, $62.50 per unit shown as $63.
    expect(forecastSummary(f, 0)).toBe("Monthly reserve $750, $63 per unit. Needed in 2026: $0.");
  });

  it("leaves out per unit until there are units, and counts rows left out", () => {
    const f = computeForecast({ startYear: 2026, unitCount: 0, components: [roof] });
    expect(forecastSummary(f, 2)).toBe("Monthly reserve $750. Needed in 2026: $0. 2 components aren't included yet.");
  });

  it("says only what's missing before there's a forecast, and nothing for an empty calculator", () => {
    expect(forecastSummary(null, 1)).toBe("1 component isn't included yet.");
    expect(forecastSummary(null, 0)).toBe("");
  });
});
