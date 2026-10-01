import { YEAR_BUILT_TEXT } from "@/components/calculator/draft";
import { computeForecast } from "@/lib/forecast";
import { COMPONENT_LIBRARY, TYPICAL_COSTS, type LibraryComponent, type TypicalCost } from "@/lib/library/components";
import { UNITS_PROBLEM } from "../inputs";
import {
  FLOOR_SQ_FT_PER_APARTMENT,
  jobShares,
  lastReplacedOnSchedule,
  PARKING_SQ_FT_PER_APARTMENT,
  quickEstimate,
  quickSystems,
  readQuickInputs,
  roundEstimate,
  SHARED_JOBS,
  TICKED_BY_DEFAULT,
} from "../quick-estimate";

const systems = quickSystems(COMPONENT_LIBRARY, TYPICAL_COSTS);
const item = (slug: string, lifeLow: number, lifeHigh: number, unitLabel: LibraryComponent["unitLabel"] = "per_unit") => ({
  slug,
  category: "Other",
  name: slug,
  lifeLow,
  lifeHigh,
  unitLabel,
});

describe("which systems the quick estimate can price", () => {
  it("offers every built-in component, in library order", () => {
    expect(systems.map((s) => s.item.slug)).toEqual(COMPONENT_LIBRARY.map((c) => c.slug));
  });

  it("turns per sq ft costs into an apartment's floor or parking area", () => {
    const area = new Map(systems.map((s) => [s.item.slug, s.perApartment]));
    expect(area.get("carpet")).toBe(FLOOR_SQ_FT_PER_APARTMENT);
    expect(area.get("luxury-vinyl-plank")).toBe(FLOOR_SQ_FT_PER_APARTMENT);
    expect(area.get("parking-lot-seal-coat")).toBe(PARKING_SQ_FT_PER_APARTMENT);
    expect(area.get("parking-lot-resurface")).toBe(PARKING_SQ_FT_PER_APARTMENT);
    expect(area.get("gas-furnace")).toBe(1);
    expect(area.get("asphalt-shingle-roof")).toBe(1);
  });

  it("leaves out rows without a typical cost, and sq ft items with no known area", () => {
    const library = [item("elevator", 20, 30, "per_building"), item("sidewalk", 25, 35, "per_sq_ft"), item("sign", 10, 20)];
    const costs: TypicalCost[] = [
      { slug: "elevator", low: 5000, high: 9000, per: "apartment" },
      { slug: "sidewalk", low: 8, high: 15, per: "sq_ft" },
    ];
    expect(quickSystems(library, costs).map((s) => s.item.slug)).toEqual(["elevator"]);
  });

  it("starts with the usual systems ticked and none of the alternatives to them", () => {
    for (const slug of TICKED_BY_DEFAULT) expect(systems.some((s) => s.item.slug === slug)).toBe(true);
    for (const job of SHARED_JOBS.filter((j) => !j.includes("carpet"))) {
      expect(job.filter((slug) => TICKED_BY_DEFAULT.has(slug))).toHaveLength(1);
    }
  });
});

describe("replaced on schedule since the building was built", () => {
  it("finds the last replacement on the cycle", () => {
    expect(lastReplacedOnSchedule(1998, 10, 2026)).toBe(2018);
    expect(lastReplacedOnSchedule(1998, 22, 2026)).toBe(2020);
    expect(lastReplacedOnSchedule(1998, 40, 2026)).toBe(1998);
    // Due this year counts as replaced this year, so nothing is ever overdue.
    expect(lastReplacedOnSchedule(2006, 10, 2026)).toBe(2026);
    expect(lastReplacedOnSchedule(2026, 10, 2026)).toBe(2026);
  });
});

describe("systems that do the same job", () => {
  it("split it equally, and others keep a full share", () => {
    const shares = jobShares(new Set(["carpet", "luxury-vinyl-plank", "gas-furnace", "boiler", "heat-pump", "asphalt-shingle-roof", "dishwasher"]));
    expect(shares.get("carpet")).toBe(0.5);
    expect(shares.get("luxury-vinyl-plank")).toBe(0.5);
    expect(shares.get("gas-furnace")).toBeCloseTo(1 / 3);
    expect(shares.get("asphalt-shingle-roof")).toBe(1);
    expect(shares.has("dishwasher")).toBe(false);
  });
});

describe("the quick estimate", () => {
  const ticked = (...slugs: string[]) => new Set(slugs);

  it("uses the full calculator's reserve on typical low and high costs", () => {
    // One water heater cycle: built 2018, 10-year life, so the next is due in 2028 (2 years).
    const waterHeater = systems.filter((s) => s.item.slug === "tank-water-heater");
    const estimate = quickEstimate(waterHeater, ticked("tank-water-heater"), 12, 2018, 2026)!;
    expect(estimate.perUnit.low).toBeCloseTo(800 / 24);
    expect(estimate.perUnit.high).toBeCloseTo(2300 / 24);
    expect(estimate.systems).toBe(1);

    const forecast = computeForecast({
      startYear: 2026,
      unitCount: 12,
      components: [
        { id: "wh", category: "Plumbing", name: "Tank water heater", quantity: 12, installYear: 2018, usefulLifeYears: 10, replacementCostEach: 800 },
      ],
    });
    expect(estimate.perUnit.low).toBeCloseTo(forecast.monthlyReservePerUnit!);
  });

  it("gives the same per-unit figure for any unit count, since costs are per apartment", () => {
    const small = quickEstimate(systems, TICKED_BY_DEFAULT, 5, 1998, 2026)!;
    const large = quickEstimate(systems, TICKED_BY_DEFAULT, 100, 1998, 2026)!;
    expect(small.perUnit.low).toBeCloseTo(large.perUnit.low);
    expect(small.perUnit.high).toBeCloseTo(large.perUnit.high);
  });

  it("keeps low at or below high, and grows when more systems are ticked", () => {
    for (const yearBuilt of [1900, 1960, 1985, 1998, 2010, 2026]) {
      const all = quickEstimate(systems, TICKED_BY_DEFAULT, 12, yearBuilt, 2026)!;
      expect(all.perUnit.low).toBeGreaterThan(0);
      expect(all.perUnit.low).toBeLessThanOrEqual(all.perUnit.high);
      const fewer = quickEstimate(systems, ticked("asphalt-shingle-roof", "gas-furnace"), 12, yearBuilt, 2026)!;
      expect(fewer.perUnit.high).toBeLessThan(all.perUnit.high);
    }
  });

  it("splits a shared floor rather than counting it twice", () => {
    const carpetOnly = quickEstimate(systems, ticked("carpet"), 12, 2020, 2026)!;
    const both = quickEstimate(systems, ticked("carpet", "luxury-vinyl-plank"), 12, 2020, 2026)!;
    const plankOnly = quickEstimate(systems, ticked("luxury-vinyl-plank"), 12, 2020, 2026)!;
    // Carpet due 2028 at $3–$6 × 800 sq ft; half the floor of each when both are ticked.
    expect(carpetOnly.perUnit.low).toBeCloseTo((3 * 800) / 24);
    expect(both.perUnit.low).toBeLessThan(carpetOnly.perUnit.low + plankOnly.perUnit.low);
    expect(both.systems).toBe(2);
  });

  it("is empty when nothing that can be priced is ticked, or there are no units", () => {
    expect(quickEstimate(systems, ticked(), 12, 1998, 2026)).toBeNull();
    expect(quickEstimate(systems, ticked("not-in-library"), 12, 1998, 2026)).toBeNull();
    expect(quickEstimate(systems, TICKED_BY_DEFAULT, 0, 1998, 2026)).toBeNull();
  });
});

describe("rounding the estimate", () => {
  it("rounds up to the next $5, or the next dollar under $10", () => {
    expect(roundEstimate(94.2)).toBe(95);
    expect(roundEstimate(95)).toBe(95);
    expect(roundEstimate(95.0000001)).toBe(95);
    expect(roundEstimate(156.1)).toBe(160);
    expect(roundEstimate(3.2)).toBe(4);
    expect(roundEstimate(9.5)).toBe(10);
    expect(roundEstimate(0)).toBe(0);
  });
});

describe("reading the quick estimate's fields", () => {
  it("reads units and year built, blank as not yet entered", () => {
    expect(readQuickInputs("12", "1998", 2026)).toEqual({ units: 12, yearBuilt: 1998, unitsProblem: null, yearBuiltProblem: null });
    expect(readQuickInputs(" 1,200 ", "", 2026)).toEqual({ units: 1200, yearBuilt: null, unitsProblem: null, yearBuiltProblem: null });
  });

  it("reports what can't be used, in the calculators' words", () => {
    expect(readQuickInputs("12.5", "98", 2026)).toEqual({
      units: null,
      yearBuilt: null,
      unitsProblem: UNITS_PROBLEM,
      yearBuiltProblem: YEAR_BUILT_TEXT,
    });
    expect(readQuickInputs("0", "2027", 2026)).toMatchObject({ unitsProblem: UNITS_PROBLEM, yearBuiltProblem: YEAR_BUILT_TEXT });
    expect(readQuickInputs("twelve", "1800", 2026)).toMatchObject({ unitsProblem: UNITS_PROBLEM, yearBuilt: 1800 });
  });
});
