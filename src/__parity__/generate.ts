// Seeded made-up buildings for the "today's numbers" tests. The same seed always
// gives the same buildings, on any machine, so the saved results can be compared.

/** A small seeded random number generator (mulberry32): the same seed, the same numbers. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The seed of the saved corpus. */
export const CORPUS_SEED = 20261002;

/** One component as the generator makes it; the tests turn it into each code's own shape. */
export interface CorpusComponent {
  id: string;
  category: string;
  name: string;
  quantity: number;
  installYear: number;
  usefulLifeYears: number;
  replacementCostEach: number;
  scenario?: "run_to_failure" | "replace_now";
  /** The install year is an estimate (missing: not said). */
  installYearIsEstimate?: boolean;
}

export interface CorpusCase {
  startYear: number;
  unitCount: number;
  components: CorpusComponent[];
}

// Names that tie on years remaining and differ only by case or accent, so the at-risk order is tested.
export const NAMES = ["Roof", "roof", "Boiler", "Éclairage", "Eclairage", "a", "B", "b", "Zinc", "Water heater", "Carpet"];
export const CATEGORIES = ["Roofing", "HVAC", "Plumbing", "Site", "Other", "Electrical", "2024"];

/** One made-up building: up to 14 components, any start year from 2020 to 2035. */
export function corpusCase(rand: () => number): CorpusCase {
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const startYear = int(2020, 2035);
  const n = int(0, 14);
  const components: CorpusComponent[] = [];
  for (let i = 0; i < n; i++) {
    const quantity = pick([1, 2, 12, int(1, 400), 9600, 0.25, rand() * 1000 + 0.001, 2.5]);
    const replacementCostEach = pick([0, 0.25, 0.1, 1100, 38000, int(0, 90000), Math.round(rand() * 1e6) / 100, rand() * 5000]);
    const usefulLifeYears = pick([1, 2, 3, 4, 8, 10, 13, 22, 30, int(1, 100)]);
    const installYear = int(startYear - 90, startYear + 8);
    components.push({
      id: `c${i}`,
      category: pick(CATEGORIES),
      name: pick(NAMES),
      quantity,
      installYear,
      usefulLifeYears,
      replacementCostEach,
      ...(rand() < 0.3 ? { installYearIsEstimate: rand() < 0.5 } : {}),
      ...(rand() < 0.3 ? { scenario: pick(["run_to_failure", "replace_now"] as const) } : {}),
    });
  }
  const unitCount = pick([0, 1, 2.5, 12, int(1, 500)]);
  return { startYear, unitCount, components };
}

export function corpus(seed: number, count: number): CorpusCase[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => corpusCase(rand));
}

/** A calculator form row, as typed (every field is text). */
export interface CorpusRow {
  librarySlug: string | null;
  category: string;
  name: string;
  quantity: string;
  unitLabel: "per_unit" | "per_building" | "per_sq_ft";
  installYear: string;
  usefulLife: string;
  costEach: string;
  scenario: "run_to_failure" | "replace_now";
  installYearIsGuess?: boolean;
}

export interface CorpusDraft {
  unitCount: string;
  yearBuilt: string;
  rows: CorpusRow[];
}

/**
 * One made-up calculator form for `year`: some rows complete, some blank install
 * years (year built stands in), the odd row the forecast can't use yet.
 */
export function corpusDraft(rand: () => number, year: number): CorpusDraft {
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const units = pick(["", "1", "12", "2.5", String(int(1, 300))]);
  const yearBuilt = pick(["", "1998", "1965", String(int(year - 80, year))]);
  const n = int(1, 10);
  const rows: CorpusRow[] = [];
  for (let i = 0; i < n; i++) {
    const unitLabel = pick(["per_unit", "per_building", "per_sq_ft"] as const);
    rows.push({
      librarySlug: null,
      category: pick(CATEGORIES),
      name: rand() < 0.05 ? "" : pick(NAMES),
      quantity: pick(["1", "12", "2.5", "9600", "0.25", String(int(1, 400)), ""]),
      unitLabel,
      installYear: rand() < 0.25 ? "" : String(int(year - 90, year)),
      usefulLife: String(pick([1, 4, 8, 10, 13, 22, 30, int(1, 100)])),
      costEach: rand() < 0.05 ? "" : pick(["0", "0.25", "1100", "38000", String(int(0, 90000)), (rand() * 5000).toFixed(2)]),
      scenario: rand() < 0.2 ? "replace_now" : "run_to_failure",
      ...(rand() < 0.2 ? { installYearIsGuess: true } : {}),
    });
  }
  return { unitCount: units, yearBuilt, rows };
}
