import { computeForecast, type ForecastComponent } from "@/lib/forecast";
import { formatCostRange, formatReserve } from "../format";

function dollars(text: string): number {
  return Number(text.replace(/[$,]/g, ""));
}

describe("reserve amounts on screen", () => {
  it("round up to the dollar", () => {
    expect(formatReserve(1071.43)).toBe("$1,072");
    expect(formatReserve(44.4)).toBe("$45");
    expect(formatReserve(1071.004)).toBe("$1,072");
  });

  it("don't add a dollar for whole amounts or float noise", () => {
    expect(formatReserve(200)).toBe("$200");
    expect(formatReserve(200.0000000001)).toBe("$200");
    expect(formatReserve(0)).toBe("$0");
  });

  it("never leave the fund short when the shown amount is saved", () => {
    const components: ForecastComponent[] = [
      { id: "roof", category: "Roofing", name: "Roof", quantity: 1, installYear: 2008, usefulLifeYears: 22, replacementCostEach: 36000 },
      { id: "wh", category: "Plumbing", name: "Water heaters", quantity: 24, installYear: 2014, usefulLifeYears: 10, replacementCostEach: 1400 },
      { id: "hvac", category: "HVAC", name: "Condensers", quantity: 12, installYear: 2019, usefulLifeYears: 14, replacementCostEach: 4500 },
    ];
    const f = computeForecast({ startYear: 2026, years: 31, unitCount: 24, components });
    const monthly = dollars(formatReserve(f.monthlyReserve));
    const perUnit = dollars(formatReserve(f.monthlyReservePerUnit ?? 0));
    let balance = 0;
    let perUnitBalance = 0;
    for (const y of f.years.slice(1)) {
      balance += monthly * 12 - y.total;
      perUnitBalance += perUnit * 24 * 12 - y.total;
      expect(balance).toBeGreaterThanOrEqual(0);
      expect(perUnitBalance).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("typical cost ranges", () => {
  it("shows whole dollars, or cents on both ends when either has them", () => {
    expect(formatCostRange(800, 2300)).toBe("$800–$2,300");
    expect(formatCostRange(3, 6)).toBe("$3–$6");
    expect(formatCostRange(0.15, 0.3)).toBe("$0.15–$0.30");
    expect(formatCostRange(2.5, 4)).toBe("$2.50–$4.00");
  });

  it("shows one figure when low and high are the same", () => {
    expect(formatCostRange(500, 500)).toBe("$500");
  });
});
