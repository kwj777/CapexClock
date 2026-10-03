import { nextDueDistribution, replacementCycles } from "..";

const sum = (due: Map<number, number>) => [...due.values()].reduce((a, b) => a + b, 0);

describe("when a component replaced on schedule is next due", () => {
  it("is exact cycles with 0 give-or-take", () => {
    expect(nextDueDistribution(1998, 10, 2026, 0)).toEqual(new Map([[2028, 1]]));
    expect(nextDueDistribution(1998, 22, 2026, 0)).toEqual(new Map([[2042, 1]]));
    expect(nextDueDistribution(1998, 40, 2026, 0)).toEqual(new Map([[2038, 1]]));
    // Due this year counts as replaced this year, so nothing is ever overdue.
    expect(nextDueDistribution(2006, 10, 2026, 0)).toEqual(new Map([[2036, 1]]));
    expect(nextDueDistribution(2026, 10, 2026, 0)).toEqual(new Map([[2036, 1]]));
    expect(nextDueDistribution(2030, 10, 2026, 0)).toEqual(new Map([[2040, 1]]));
  });

  it("spreads each replacement up to the give-or-take years either side", () => {
    const due = nextDueDistribution(2018, 10, 2026, 2);
    expect([...due.keys()].sort()).toEqual([2027, 2028, 2029, 2030, 2034, 2035, 2036, 2037, 2038]);
    for (const year of [2027, 2028, 2029, 2030]) expect(due.get(year)).toBeCloseTo(1 / 5);
    for (const year of [2034, 2035, 2036, 2037, 2038]) expect(due.get(year)).toBeCloseTo(1 / 25);
  });

  it("caps give-or-take below the life, so two replacements never share a year", () => {
    expect(nextDueDistribution(2020, 1, 2026, 2)).toEqual(new Map([[2027, 1]]));
    const two = nextDueDistribution(2026, 2, 2026, 2);
    expect([...two.keys()].sort()).toEqual([2027, 2028, 2029]);
    for (const chance of two.values()) expect(chance).toBeCloseTo(1 / 3);
  });

  it("adds up to 1 and never lands on or before the current year", () => {
    for (const giveOrTake of [0, 2, 5]) {
      for (let since = 1800; since <= 2030; since += 7) {
        for (const life of [1, 2, 3, 10, 25, 40, 100]) {
          const due = nextDueDistribution(since, life, 2026, giveOrTake);
          expect(sum(due)).toBeCloseTo(1, 9);
          for (const year of due.keys()) {
            expect(year).toBeGreaterThan(2026);
            expect(year).toBeLessThanOrEqual(2026 + life + giveOrTake);
          }
        }
      }
    }
  });

  it("evens out for a component installed long ago, as early and late replacements add up", () => {
    // Over 20 replacements since 1800, no year is likelier than another: a tenth in each of the next
    // 8 years, then less in each year after, as only the replacements that run late are left.
    const due = nextDueDistribution(1800, 10, 2026, 2);
    for (let year = 2027; year <= 2034; year++) expect(due.get(year)).toBeCloseTo(0.1, 3);
    expect([2035, 2036, 2037, 2038].map((year) => due.get(year))).toEqual([
      expect.closeTo(0.08, 3),
      expect.closeTo(0.06, 3),
      expect.closeTo(0.04, 3),
      expect.closeTo(0.02, 3),
    ]);
    // Neighbouring install years come out the same.
    expect(nextDueDistribution(1801, 10, 2026, 2).get(2027)).toBeCloseTo(0.1, 3);
  });

  it("refuses years, lives or give-or-take it can't use", () => {
    expect(() => nextDueDistribution(1998.5, 10, 2026, 0)).toThrow("Years must be whole years.");
    expect(() => nextDueDistribution(1998, 10, 2026.5, 0)).toThrow("Years must be whole years.");
    for (const life of [0, 101, 2.5, Number.NaN]) {
      expect(() => nextDueDistribution(1998, life, 2026, 0)).toThrow("Useful life must be a whole number of years from 1 to 100.");
    }
    for (const g of [-1, 0.5, Number.NaN]) {
      expect(() => nextDueDistribution(1998, 10, 2026, g)).toThrow("Give-or-take years must be a whole number, 0 or more.");
    }
  });
});

describe("a component split across lives", () => {
  it("gives each life an equal share, split by when it's next due", () => {
    const cycles = replacementCycles([15, 16, 17, 18, 19, 20], 1990, 2026, 2);
    expect(new Set(cycles.map((c) => c.life))).toEqual(new Set([15, 16, 17, 18, 19, 20]));
    expect(cycles.reduce((t, c) => t + c.share, 0)).toBeCloseTo(1);
    expect(cycles.filter((c) => c.life === 15).reduce((t, c) => t + c.share, 0)).toBeCloseTo(1 / 6);
    expect(cycles.find((c) => c.life === 15 && c.due === 2035)?.share).toBeCloseTo((1 / 6) * (19 / 125));
  });

  it("is one schedule for one life with no give-or-take", () => {
    expect(replacementCycles([18], 1990, 2026, 0)).toEqual([{ life: 18, due: 2044, share: 1 }]);
    expect(replacementCycles([], 1990, 2026, 0)).toEqual([]);
  });
});
