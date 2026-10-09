import type { Component } from "@/engine";
import { biggestDueCluster } from "../cluster";
import { exampleDraft } from "../draft/example";
import { forecastDraft, landlordForecast } from "../forecast";

const START = 2026;

function component(id: string, name: string, installYear: number, life: number, cost: number): Component {
  return { id, category: "Other", name, quantity: 1, installYear, usefulLifeYears: life, replacementCostEach: cost };
}

describe("the biggest year with several things due", () => {
  it("names the example building's 2030 roof and furnace", () => {
    const { forecast } = forecastDraft(exampleDraft(), START);
    expect(biggestDueCluster(forecast)).toEqual({ year: 2030, names: ["Asphalt shingle roof", "Gas furnace"], total: 88_400 });
  });

  it("is null when the costliest year has only one thing due", () => {
    const f = landlordForecast(
      [component("roof", "Roof", 2010, 20, 30_000), component("wh", "Water heater", 2019, 10, 1_000), component("ac", "AC", 2017, 12, 1_000)],
      1,
      START,
    );
    expect(biggestDueCluster(f)).toBeNull();
  });

  it("skips the first year, which is already shown as needed now", () => {
    const f = landlordForecast(
      [component("a", "Boiler", 2000, 20, 50_000), component("b", "Roof", 2000, 20, 50_000), component("c", "Paint", 2020, 8, 500), component("d", "Seal coat", 2020, 8, 500)],
      1,
      START,
    );
    expect(biggestDueCluster(f)).toEqual({ year: 2028, names: ["Paint", "Seal coat"], total: 1_000 });
  });

  it("takes the earlier year on a tie, and is null when nothing is due", () => {
    const f = landlordForecast(
      [component("a", "A", 2018, 10, 100), component("b", "B", 2018, 10, 100), component("c", "C", 2020, 10, 100), component("d", "D", 2020, 10, 100)],
      1,
      START,
    );
    expect(biggestDueCluster(f)?.year).toBe(2028);
    expect(biggestDueCluster(landlordForecast([], 1, START))).toBeNull();
  });
});

it("lists a name once when two rows share it", () => {
  const f = landlordForecast(
    [component("a", "Water heater", 2020, 10, 100), component("b", "Water heater", 2020, 10, 100)],
    1,
    START,
  );
  expect(biggestDueCluster(f)).toBeNull();
});
