import { computeForecast } from "@/lib/forecast";
import { COMPONENT_LIBRARY } from "../../library/components";
import { badYearBuilt, PROBLEM_TEXT, problemFields, problemText, toComponents } from "../components";
import { exampleDraft } from "../example";
import type { Draft, DraftRow } from "../model";
import { customRow, rowFromLibrary } from "../rows";

const waterHeater = COMPONENT_LIBRARY.find((c) => c.slug === "tank-water-heater")!;
const carpet = COMPONENT_LIBRARY.find((c) => c.slug === "carpet")!;

describe("calculator rows to forecast components", () => {
  it("defaults a blank install year to year built and flags it as an estimate", () => {
    const row = { ...rowFromLibrary(waterHeater, "24"), costEach: "$1,400" };
    const { components, problems } = toComponents({ unitCount: "24", yearBuilt: "2014", rows: [row] }, 2026);
    expect(problems).toEqual({});
    expect(components[0]).toMatchObject({
      quantity: 24,
      installYear: 2014,
      installYearIsEstimate: true,
      usefulLifeYears: 10,
      replacementCostEach: 1400,
    });
  });

  it("uses one row for bulk items: 24 water heaters from 2014 at $1,400", () => {
    const row = { ...rowFromLibrary(waterHeater, "24"), installYear: "2014", costEach: "1400" };
    const { components } = toComponents({ unitCount: "24", yearBuilt: "", rows: [row] }, 2026);
    const f = computeForecast({ startYear: 2026, unitCount: 24, components });
    expect(f.years[0].total).toBe(33600);
  });

  it("reports incomplete rows instead of guessing", () => {
    const noCost = rowFromLibrary(waterHeater, "4");
    const noYear = { ...rowFromLibrary(waterHeater, "4"), costEach: "900" };
    const noName = { ...customRow(), costEach: "100", installYear: "2020", usefulLife: "5" };
    const badLife = { ...rowFromLibrary(waterHeater, "4"), costEach: "900", installYear: "2020", usefulLife: "0" };
    const draft: Draft = { unitCount: "4", yearBuilt: "", rows: [noCost, noYear, noName, badLife] };
    const { components, problems } = toComponents(draft, 2026);
    expect(components).toEqual([]);
    expect(Object.values(problems)).toEqual(["missing_install_year", "missing_install_year", "missing_name", "invalid"]);
  });

  it("the example building produces a forecast with every row included", () => {
    const draft = exampleDraft();
    const { components, problems } = toComponents(draft, 2026);
    expect(problems).toEqual({});
    expect(components).toHaveLength(draft.rows.length);
  });

  it("rejects install-year typos instead of treating them as ancient or future", () => {
    const rows = ["98", "2106", "2031", "2016.5"].map((installYear) => ({
      ...rowFromLibrary(waterHeater, "4"),
      costEach: "900",
      installYear,
    }));
    const { components, problems } = toComponents({ unitCount: "4", yearBuilt: "", rows }, 2026);
    expect(components).toEqual([]);
    expect(Object.values(problems)).toEqual(Array(4).fill("bad_install_year"));
  });

  it("blames year built, not the row, when a blank install year falls back to a bad year built", () => {
    const blank = { ...rowFromLibrary(waterHeater, "4"), costEach: "900" };
    const dated = { ...blank, id: "dated", installYear: "2020" };
    const { components, problems } = toComponents({ unitCount: "4", yearBuilt: "98", rows: [blank, dated] }, 2026);
    expect(problems).toEqual({ [blank.id]: "bad_year_built" });
    expect(components.map((c) => c.id)).toEqual(["dated"]);
  });

  it("accepts a year built back to 1800 for rows without an install year", () => {
    const blank = { ...rowFromLibrary(waterHeater, "4"), costEach: "900" };
    const { components, problems } = toComponents({ unitCount: "4", yearBuilt: "1890", rows: [blank] }, 2026);
    expect(problems).toEqual({});
    expect(components[0]).toMatchObject({ installYear: 1890, installYearIsEstimate: true });
  });

  it("still keeps typed install years to 1900 or later", () => {
    const old = { ...rowFromLibrary(waterHeater, "4"), costEach: "900", installYear: "1890" };
    const { problems } = toComponents({ unitCount: "4", yearBuilt: "1890", rows: [old] }, 2026);
    expect(Object.values(problems)).toEqual(["bad_install_year"]);
  });

  it("checks year built on its own", () => {
    expect(badYearBuilt("", 2026)).toBe(false);
    expect(badYearBuilt("1800", 2026)).toBe(false);
    expect(badYearBuilt("2026", 2026)).toBe(false);
    for (const bad of ["98", "1799", "2027", "1998.5", "abc"]) expect(badYearBuilt(bad, 2026)).toBe(true);
  });

  it("flags a cost it can't read as invalid, not missing", () => {
    const row = { ...rowFromLibrary(waterHeater, "4"), installYear: "2016", costEach: "1.4k" };
    const { problems } = toComponents({ unitCount: "4", yearBuilt: "", rows: [row] }, 2026);
    expect(Object.values(problems)).toEqual(["invalid"]);
  });
});

describe("pointing a row's note at the field it's about", () => {
  const dated = { ...rowFromLibrary(waterHeater, "4"), installYear: "2016", costEach: "900" };

  it("names the one field that's missing or out of range", () => {
    const cases: [DraftRow, string][] = [
      [{ ...dated, name: " " }, "name"],
      [{ ...dated, installYear: "" }, "installYear"],
      [{ ...dated, installYear: "98" }, "installYear"],
      [{ ...dated, costEach: "" }, "costEach"],
    ];
    for (const [row, field] of cases) {
      const problem = toComponents({ unitCount: "4", yearBuilt: "", rows: [row] }, 2026).problems[row.id];
      expect(problemFields(row, problem)).toEqual([field]);
    }
  });

  it("sends a blank install year to the install year when year built is the trouble", () => {
    const row = { ...dated, installYear: "" };
    const problem = toComponents({ unitCount: "4", yearBuilt: "98", rows: [row] }, 2026).problems[row.id];
    expect(problem).toBe("bad_year_built");
    expect(problemFields(row, problem)).toEqual(["installYear"]);
  });

  it("says which number can't be used instead of listing all three", () => {
    const badCost = { ...dated, costEach: "1.4k" };
    expect(problemFields(badCost, "invalid")).toEqual(["costEach"]);
    expect(problemText(badCost, "invalid")).toBe("Cost should be a plain number, like 1400.");

    const badLifeAndQty = { ...dated, quantity: "twelve", usefulLife: "0" };
    expect(problemFields(badLifeAndQty, "invalid")).toEqual(["quantity", "usefulLife"]);
    expect(problemText(badLifeAndQty, "invalid")).toBe(
      "Quantity should be a number above 0, like 12. Useful life should be a whole number of years from 1 to 100.",
    );

    const badSqFt = { ...rowFromLibrary(carpet, "4"), quantity: "-5", installYear: "2020", costEach: "4" };
    expect(problemText(badSqFt, "invalid")).toBe("Square feet should be a number above 0, like 1200.");
  });

  it("keeps the fixed wording for the other problems", () => {
    expect(problemText(dated, "missing_cost")).toBe(PROBLEM_TEXT.missing_cost);
  });
});
