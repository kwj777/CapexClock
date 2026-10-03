import type { Component } from "@/engine";
import { landlordForecast } from "../forecast";
import { MOCKUP_SERIES_KEYS, MOCKUP_SPEND, MOCKUP_UNITS, mockupBadgeReserve, mockupReservePerUnit } from "../mockup";

describe("the home page's forecast mockup", () => {
  it("has the reserve the calculator gives for the same bills", () => {
    // One component per bar segment, due in that bar's year and not again for 100 years.
    const startYear = 2026;
    const components: Component[] = MOCKUP_SPEND.flatMap((values, i) =>
      MOCKUP_SERIES_KEYS.filter((key) => values[key] > 0).map((key) => ({
        id: `${key}-${i}`,
        category: key,
        name: key,
        quantity: 1,
        installYear: startYear + i - 100,
        usefulLifeYears: 100,
        replacementCostEach: values[key] * 1000,
      })),
    );
    const forecast = landlordForecast(components, MOCKUP_UNITS, startYear);
    expect(forecast.years.map((y) => y.total / 1000)).toEqual([6, 15, 7, 42, 13, 6, 26, 2, 15, 23]);
    expect(mockupReservePerUnit()).toBeCloseTo(forecast.monthlyReservePerUnit!, 6);
    // The $42k year four sets it: $64k over 36 months, for 12 units.
    expect(mockupReservePerUnit()).toBeCloseTo(64000 / 36 / 12, 6);
  });

  it("rounds the badge up to whole dollars: $149", () => {
    expect(mockupBadgeReserve()).toBe(149);
    expect(mockupBadgeReserve()).toBe(Math.ceil(mockupReservePerUnit()));
  });
});
