import { readFileSync } from "node:fs";
import { join } from "node:path";
import { exampleDraft } from "@/components/calculator/draft";
import type { ForecastComponent } from "@/lib/forecast";
import {
  ageText,
  conditionCounts,
  lifeStatus,
  remainingLifeText,
  reportRows,
  statusText,
  type ReportInput,
} from "../condition-report";
import { sampleReport, SAMPLE_NOTE } from "../sample";

const component = (over: Partial<ForecastComponent>): ForecastComponent => ({
  id: "c",
  category: "Plumbing",
  name: "Water heater",
  quantity: 12,
  installYear: 2016,
  usefulLifeYears: 10,
  replacementCostEach: 1400,
  ...over,
});
const input = (over: Partial<ForecastComponent>, rest: Partial<ReportInput> = {}): ReportInput => ({
  component: component(over),
  unitLabel: "per_unit",
  condition: null,
  notes: "",
  ...rest,
});

describe("lifeStatus", () => {
  it("matches the forecast's at risk: past end of life, or within 2 years", () => {
    expect(lifeStatus(-1)).toBe("overdue");
    expect(lifeStatus(0)).toBe("due_soon");
    expect(lifeStatus(2)).toBe("due_soon");
    expect(lifeStatus(3)).toBe("ok");
  });
});

describe("reportRows", () => {
  const rows = reportRows(
    [
      input({ id: "roof", name: "Roof", installYear: 2008, usefulLifeYears: 22, quantity: 1, replacementCostEach: 38000 }),
      input({ id: "fridge", name: "Refrigerator", installYear: 1998, installYearIsEstimate: true, usefulLifeYears: 13 }, {
        condition: "fair",
        notes: "  Mixed ages.  ",
      }),
      input({ id: "wh", installYear: 2016, usefulLifeYears: 10 }, { condition: "poor" }),
    ],
    2026,
  );

  it("puts the ones nearest the end of their life first", () => {
    expect(rows.map((r) => r.id)).toEqual(["fridge", "wh", "roof"]);
  });

  it("works out age, end of life and remaining life from the report's year", () => {
    expect(rows[0]).toMatchObject({ age: 28, endOfLifeYear: 2011, remainingLife: -15, status: "overdue" });
    expect(rows[1]).toMatchObject({ age: 10, endOfLifeYear: 2026, remainingLife: 0, status: "due_soon" });
    expect(rows[2]).toMatchObject({ age: 18, endOfLifeYear: 2030, remainingLife: 4, status: "ok" });
  });

  it("keeps the owner's condition, notes and estimate flag, and prices the whole quantity", () => {
    expect(rows[0]).toMatchObject({ condition: "fair", notes: "Mixed ages.", installYearIsEstimate: true });
    expect(rows[1].replacementCost).toBe(16800);
    expect(rows[2]).toMatchObject({ condition: null, installYearIsEstimate: false, replacementCost: 38000 });
  });

  it("never counts a negative age", () => {
    expect(reportRows([input({ installYear: 2026 })], 2025)[0].age).toBe(0);
  });
});

describe("report wording", () => {
  it("says ages, with the estimate marked", () => {
    expect(ageText({ age: 18, installYearIsEstimate: false })).toBe("18 years");
    expect(ageText({ age: 1, installYearIsEstimate: false })).toBe("1 year");
    expect(ageText({ age: 0, installYearIsEstimate: false })).toBe("Under 1 year");
    expect(ageText({ age: 28, installYearIsEstimate: true })).toBe("28 years (est.)");
  });

  it("says remaining life", () => {
    expect(remainingLifeText(4)).toBe("4 years");
    expect(remainingLifeText(1)).toBe("1 year");
    expect(remainingLifeText(0)).toBe("Due this year");
    expect(remainingLifeText(-1)).toBe("1 year past");
    expect(remainingLifeText(-15)).toBe("15 years past");
  });

  it("marks what's at risk", () => {
    expect(statusText("overdue")).toBe("Past end of life");
    expect(statusText("due_soon")).toBe("Due within 2 years");
    expect(statusText("ok")).toBe("");
  });

  it("counts the owner's ratings, leaving out unrated rows", () => {
    expect(conditionCounts([{ condition: "poor" }, { condition: null }, { condition: "good" }, { condition: "poor" }])).toEqual([
      { condition: "good", count: 1 },
      { condition: "poor", count: 2 },
    ]);
    expect(conditionCounts([{ condition: null }])).toEqual([]);
  });
});

describe("the sample report", () => {
  const sample = sampleReport(2026);

  it("is the calculator's example building, every component rated", () => {
    const example = exampleDraft();
    expect(sample.unitCount).toBe(Number(example.unitCount));
    expect(sample.yearBuilt).toBe(Number(example.yearBuilt));
    expect(sample.rows.map((r) => r.name).sort()).toEqual(example.rows.map((r) => r.name).sort());
    expect(sample.rows.every((r) => r.condition !== null && r.notes !== "")).toBe(true);
  });

  it("has at-risk items, an estimated install year, and a forecast with a reserve", () => {
    expect(sample.rows.filter((r) => r.status !== "ok").length).toBeGreaterThan(0);
    expect(sample.rows.some((r) => r.installYearIsEstimate)).toBe(true);
    expect(sample.forecast.startYear).toBe(2026);
    expect(sample.forecast.monthlyReserve).toBeGreaterThan(0);
    expect(sample.forecast.monthlyReservePerUnit).toBeCloseTo(sample.forecast.monthlyReserve / sample.unitCount);
  });

  it("says it's made up", () => {
    expect(SAMPLE_NOTE).toMatch(/sample/i);
    expect(SAMPLE_NOTE).toContain("made up");
  });

  it("is committed as a PDF of a few pages", () => {
    const pdf = readFileSync(join(__dirname, "../../../../public/sample-condition-report.pdf"));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = pdf.toString("latin1").match(/\/Type \/Page(?!s)/g) ?? [];
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages.length).toBeLessThanOrEqual(5);
  });
});
