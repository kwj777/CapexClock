import { YEAR_BUILT_TEXT } from "@/components/calculator/draft";
import { computeForecast } from "@/lib/forecast";
import { COMPONENT_LIBRARY, TYPICAL_COSTS, type LibraryComponent, type TypicalCost } from "@/lib/library/components";
import {
  FLOOR_SQ_FT_PER_APARTMENT,
  GIVE_OR_TAKE_YEARS,
  jobShares,
  lastReplacedOnSchedule,
  MAX_QUICK_UNITS,
  PARKING_SQ_FT_PER_APARTMENT,
  QUICK_UNITS_PROBLEM,
  quickEstimate,
  quickSystems,
  readQuickInputs,
  replacementCycles,
  roundEstimate,
  SHARED_JOBS,
  SPREAD_REPLACEMENTS,
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
    // A schedule that starts after this year hasn't had a replacement yet.
    expect(lastReplacedOnSchedule(2028, 10, 2026)).toBe(2028);
  });

  it("never leaves anything overdue or due this year", () => {
    for (let start = 1900; start <= 2030; start++) {
      for (const life of [3, 10, 25, 40]) {
        const last = lastReplacedOnSchedule(start, life, 2026);
        expect(last + life).toBeGreaterThan(2026);
        expect((last - start) % life).toBe(0);
      }
    }
  });

  it("spreads a system over every lifespan in its range, a year or two either side of schedule", () => {
    const furnace = item("furnace", 15, 20);
    const cycles = replacementCycles(furnace, 1990, 2026, true);
    expect(cycles).toHaveLength(6 * (2 * GIVE_OR_TAKE_YEARS + 1));
    expect(new Set(cycles.map((c) => c.life))).toEqual(new Set([15, 16, 17, 18, 19, 20]));
    expect(cycles.reduce((sum, c) => sum + c.share, 0)).toBeCloseTo(1);
    // A 15-year life from 1990: replaced 2020, so due 2035. Started 2 years early: 2018, due 2033.
    expect(cycles).toContainEqual({ life: 15, lastReplaced: 2020, share: 1 / 30 });
    expect(cycles).toContainEqual({ life: 15, lastReplaced: 2018, share: 1 / 30 });
    for (const c of cycles) expect(c.lastReplaced + c.life).toBeGreaterThan(2026);
  });

  it("keeps one schedule at the middle of the range when not spread", () => {
    expect(replacementCycles(item("furnace", 15, 20), 1990, 2026, false)).toEqual([{ life: 18, lastReplaced: 2026, share: 1 }]);
  });

  it("spreads replacements by default (Kevin's choice in typical-costs.md)", () => {
    expect(SPREAD_REPLACEMENTS).toBe(true);
    expect(replacementCycles(item("furnace", 15, 20), 1990, 2026)).toEqual(replacementCycles(item("furnace", 15, 20), 1990, 2026, true));
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
    // Exactly on schedule: built 2018, 10-year life, so the next is due in 2028 (2 years).
    const waterHeater = systems.filter((s) => s.item.slug === "tank-water-heater");
    const estimate = quickEstimate(waterHeater, ticked("tank-water-heater"), 12, 2018, 2026, false)!;
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

  it("spreads a system's next replacement over the years around when it's due", () => {
    // A 10-year item built 2018, give or take 2 years: a fifth each due in 2027, 2028, 2029 and 2030,
    // and a fifth replaced this year (due 2036). Saving for 2028–2030 sets the level: 3/5 of the cost in 36 months.
    const tenYears = quickSystems([item("heater", 10, 10)], [{ slug: "heater", low: 600, high: 1200, per: "apartment" }]);
    const estimate = quickEstimate(tenYears, ticked("heater"), 12, 2018, 2026, true)!;
    expect(estimate.perUnit.low).toBeCloseTo(600 / 60);
    expect(estimate.perUnit.high).toBeCloseTo(1200 / 60);
    // Exactly on schedule, all of it is due in 2028: the whole cost in 24 months.
    expect(quickEstimate(tenYears, ticked("heater"), 12, 2018, 2026, false)!.perUnit.low).toBeCloseTo(600 / 24);
  });

  it("changes gradually from one year built to the next, with every system or the usual ones", () => {
    // Exactly on schedule, a 2002 building has windows, cabinets, gutters and paint all due next year,
    // and comes out about 4 times a 2001 building. Spread, neighbouring years stay within 1.5 times.
    const everything = new Set(systems.map((s) => s.item.slug));
    for (const tickedSet of [TICKED_BY_DEFAULT, everything]) {
      let previous: { low: number; high: number } | null = null;
      for (let yearBuilt = 1900; yearBuilt <= 2026; yearBuilt++) {
        const { perUnit } = quickEstimate(systems, tickedSet, 12, yearBuilt, 2026, true)!;
        if (previous) {
          for (const end of ["low", "high"] as const) {
            const ratio = perUnit[end] / previous[end];
            expect(Math.max(ratio, 1 / ratio)).toBeLessThan(1.5);
          }
        }
        previous = perUnit;
      }
    }
    const exact = (yearBuilt: number) => quickEstimate(systems, TICKED_BY_DEFAULT, 12, yearBuilt, 2026, false)!.perUnit.high;
    expect(exact(2002) / exact(2001)).toBeGreaterThan(4);
  });

  it("gives the same per-unit figure for any unit count, since costs are per apartment", () => {
    const small = quickEstimate(systems, TICKED_BY_DEFAULT, 5, 1998, 2026)!;
    const large = quickEstimate(systems, TICKED_BY_DEFAULT, 100, 1998, 2026)!;
    expect(small.perUnit.low).toBeCloseTo(large.perUnit.low);
    expect(small.perUnit.high).toBeCloseTo(large.perUnit.high);
  });

  it("keeps low at or below high, and grows when more systems are ticked", () => {
    for (const spread of [true, false]) {
      for (const yearBuilt of [1900, 1960, 1985, 1998, 2010, 2026]) {
        const all = quickEstimate(systems, TICKED_BY_DEFAULT, 12, yearBuilt, 2026, spread)!;
        expect(all.perUnit.low).toBeGreaterThan(0);
        expect(all.perUnit.low).toBeLessThanOrEqual(all.perUnit.high);
        const fewer = quickEstimate(systems, ticked("asphalt-shingle-roof", "gas-furnace"), 12, yearBuilt, 2026, spread)!;
        expect(fewer.perUnit.high).toBeLessThan(all.perUnit.high);
      }
    }
  });

  it("splits a shared floor rather than counting it twice", () => {
    const carpetOnly = quickEstimate(systems, ticked("carpet"), 12, 2020, 2026, false)!;
    const both = quickEstimate(systems, ticked("carpet", "luxury-vinyl-plank"), 12, 2020, 2026, false)!;
    const plankOnly = quickEstimate(systems, ticked("luxury-vinyl-plank"), 12, 2020, 2026, false)!;
    // Carpet due 2028 at $3–$6 × 800 sq ft; half the floor of each when both are ticked.
    expect(carpetOnly.perUnit.low).toBeCloseTo((3 * 800) / 24);
    expect(both.perUnit.low).toBeLessThan(carpetOnly.perUnit.low + plankOnly.perUnit.low);
    expect(both.systems).toBe(2);
  });

  it("is empty when nothing that can be priced is ticked, or there are no units", () => {
    expect(quickEstimate(systems, ticked(), 12, 1998, 2026)).toBeNull();
    expect(quickEstimate(systems, ticked("not-in-library"), 12, 1998, 2026)).toBeNull();
    expect(quickEstimate(systems, TICKED_BY_DEFAULT, 0, 1998, 2026)).toBeNull();
    expect(quickEstimate(systems, TICKED_BY_DEFAULT, -3, 1998, 2026)).toBeNull();
  });

  it("is empty rather than an error when the unit count is too big to work out", () => {
    for (const units of [1e308, Infinity, NaN]) {
      expect(() => quickEstimate(systems, TICKED_BY_DEFAULT, units, 1998, 2026)).not.toThrow();
      expect(quickEstimate(systems, TICKED_BY_DEFAULT, units, 1998, 2026)).toBeNull();
    }
    expect(quickEstimate(systems, TICKED_BY_DEFAULT, MAX_QUICK_UNITS, 1998, 2026)).not.toBeNull();
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

  it("reports what can't be used, with the year in the calculators' words", () => {
    expect(readQuickInputs("12.5", "98", 2026)).toEqual({
      units: null,
      yearBuilt: null,
      unitsProblem: QUICK_UNITS_PROBLEM,
      yearBuiltProblem: YEAR_BUILT_TEXT,
    });
    expect(readQuickInputs("0", "2027", 2026)).toMatchObject({ unitsProblem: QUICK_UNITS_PROBLEM, yearBuiltProblem: YEAR_BUILT_TEXT });
    expect(readQuickInputs("twelve", "1800", 2026)).toMatchObject({ unitsProblem: QUICK_UNITS_PROBLEM, yearBuilt: 1800 });
  });

  it("takes up to 100,000 units, so a huge number is reported rather than worked out", () => {
    expect(readQuickInputs("100,000", "1998", 2026)).toMatchObject({ units: 100000, unitsProblem: null });
    for (const units of ["100001", "1e308", "1e400", "-3"]) {
      expect(readQuickInputs(units, "1998", 2026)).toMatchObject({ units: null, unitsProblem: QUICK_UNITS_PROBLEM });
    }
  });
});
