// Plain data for the engine's tests. Nothing here imports from outside the engine.
import type { Component } from "..";

export const START = 2026;

/** A component with sensible defaults: one $1,000 item installed in 2020 that lasts 10 years. */
export function component(overrides: Partial<Component> = {}): Component {
  return {
    id: "c1",
    category: "Plumbing",
    name: "Tank water heater",
    quantity: 1,
    installYear: 2020,
    usefulLifeYears: 10,
    replacementCostEach: 1000,
    ...overrides,
  };
}

/**
 * Three components: a roof due 2030, 24 water heaters overdue (paid in 2026) and
 * 12 condensers due 2033. The monthly reserve is $90,000 over 84 months.
 */
export const BUILDING: readonly Component[] = [
  component({ id: "roof", category: "Roofing", name: "Roof", quantity: 1, installYear: 2008, usefulLifeYears: 22, replacementCostEach: 36000 }),
  component({ id: "wh", category: "Plumbing", name: "Water heaters", quantity: 24, installYear: 2014, usefulLifeYears: 10, replacementCostEach: 1400 }),
  component({ id: "hvac", category: "HVAC", name: "Condensers", quantity: 12, installYear: 2019, usefulLifeYears: 14, replacementCostEach: 4500 }),
];

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

/** Up to 12 valid random components around `startYear`. */
export function randomComponents(rand: () => number, startYear: number): Component[] {
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  return Array.from({ length: int(0, 12) }, (_, i) => ({
    id: `c${i}`,
    category: pick(["Roofing", "HVAC", "Site", "Other"]),
    name: pick(["Roof", "Boiler", "Paving", "Lights"]),
    quantity: pick([1, 2.5, 12, 9600, rand() * 100 + 0.01]),
    installYear: int(startYear - 80, startYear + 5),
    usefulLifeYears: pick([1, 3, 8, 15, 30, int(1, 100)]),
    replacementCostEach: pick([0, 0.25, 1400, 38000, rand() * 5000]),
    ...(rand() < 0.3 ? { scenario: pick(["run_to_failure", "replace_now"] as const) } : {}),
    ...(rand() < 0.3 ? { estimated: { installYear: rand() < 0.5 } } : {}),
  }));
}
