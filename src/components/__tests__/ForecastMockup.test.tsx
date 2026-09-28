import { renderToStaticMarkup } from "react-dom/server";
import { computeForecast, type ForecastComponent } from "@/lib/forecast";
import ForecastMockup, { MOCKUP_SPEND, MOCKUP_UNITS, mockupReservePerUnit } from "../ForecastMockup";

describe("home page forecast mockup", () => {
  it("shows the reserve the calculator gives for the same bills", () => {
    // One component per bar segment, due in that bar's year and not again for 100 years.
    const startYear = 2026;
    const components: ForecastComponent[] = MOCKUP_SPEND.flatMap((values, i) =>
      Object.entries(values)
        .filter(([, k]) => k > 0)
        .map(([key, k]) => ({
          id: `${key}-${i}`,
          category: key,
          name: key,
          quantity: 1,
          installYear: startYear + i - 100,
          usefulLifeYears: 100,
          replacementCostEach: k * 1000,
        })),
    );
    const forecast = computeForecast({ startYear, unitCount: MOCKUP_UNITS, components });
    expect(forecast.years.map((y) => y.total / 1000)).toEqual([6, 15, 7, 42, 13, 6, 26, 2, 15, 23]);
    expect(mockupReservePerUnit()).toBeCloseTo(forecast.monthlyReservePerUnit!, 6);
    // The $42k year four sets it: $64k over 36 months, for 12 units.
    expect(mockupReservePerUnit()).toBeCloseTo(64000 / 36 / 12, 6);
  });

  it("rounds the badge up and starts the chart this year", () => {
    const html = renderToStaticMarkup(<ForecastMockup />);
    expect(html).toContain("$149<span");
    const year = new Date().getFullYear();
    expect(html).toContain(`from ${year} to ${year + 9}, with a roof replacement spike in ${year + 3}.`);
    expect(html).toContain(`&#x27;${String(year).slice(2)}`);
  });
});
