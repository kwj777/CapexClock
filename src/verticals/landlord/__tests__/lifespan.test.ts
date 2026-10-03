import { COMPONENT_LIBRARY, type LibraryComponent } from "../library/components";
import { lifespanEstimate } from "../lifespan";

const START = 2026;
const find = (slug: string): LibraryComponent => {
  const item = COMPONENT_LIBRARY.find((c) => c.slug === slug);
  if (!item) throw new Error(slug);
  return item;
};
const waterHeater = find("tank-water-heater"); // 8–12 years, 10 in the middle, per unit
const carpet = find("carpet"); // 5–10 years, 8 in the middle, per sq ft
const panel = find("electrical-panel"); // 25–40 years, 33 in the middle

const estimate = (item: LibraryComponent, installYear: string, quantity = "", costEach = "") =>
  lifespanEstimate({ item, installYear, quantity, costEach, currentYear: START });

describe("the install year", () => {
  it("shows nothing until a year is typed", () => {
    for (const blank of ["", "  "]) expect(estimate(waterHeater, blank)).toEqual({ life: 10, badYear: false, result: null, moneyHint: null });
  });

  it("refuses anything that isn't a 4-digit year from 1900 to this year", () => {
    for (const bad of ["98", "1899", "2027", "2014.5", "abc", "1e400"]) {
      expect(estimate(waterHeater, bad)).toMatchObject({ badYear: true, result: null, moneyHint: null });
    }
    expect(estimate(waterHeater, "1900").badYear).toBe(false);
    expect(estimate(waterHeater, "2026").badYear).toBe(false);
  });

  it("gives when it's due, from the middle of the typical life, and the typical range", () => {
    expect(estimate(waterHeater, "2020").result).toEqual({
      due: 2030,
      low: 2028,
      high: 2032,
      yearsLeft: 4,
      monthly: null,
      neededNow: null,
      savingFor: null,
      forecastCountsFrom: null,
    });
    expect(estimate(waterHeater, "2016").result?.yearsLeft).toBe(0);
    expect(estimate(waterHeater, "2010").result?.yearsLeft).toBe(-6);
  });
});

describe("what to set aside", () => {
  it("saves for the next replacement month by month", () => {
    // $1,200 installed 2020 with a 10-year life: $25.00 a month for 2030.
    const r = estimate(waterHeater, "2020", "1", "1,200").result;
    expect(r).toMatchObject({ monthly: 25, neededNow: 0, savingFor: 2030 });
  });

  it("budgets this year for one past due, and saves for the one after", () => {
    const r = estimate(waterHeater, "2010", "12", "$1,400").result;
    expect(r).toMatchObject({ neededNow: 16800, savingFor: 2036 });
    expect(r?.monthly).toBe(16800 / 120);
  });

  it("says when the building forecast starts counting a replacement past its 30-year look-ahead", () => {
    // Installed last year with a 33-year life: due 2058, which a 30-year look-ahead reaches in 2028.
    expect(estimate(panel, "2025", "12", "2500").result).toMatchObject({ savingFor: 2058, forecastCountsFrom: 2028 });
    // Due in exactly 30 years is already counted.
    expect(estimate(panel, "2023", "12", "2500").result).toMatchObject({ savingFor: 2056, forecastCountsFrom: null });
  });

  it("says which field to fix before it can show a dollar figure", () => {
    expect(estimate(waterHeater, "2020", "12", "1.4k").moneyHint).toEqual({
      text: "Enter the cost as a plain number, like 1400.",
      field: "cost",
      invalid: true,
    });
    expect(estimate(waterHeater, "2020", "12", "-5").moneyHint?.field).toBe("cost");
    expect(estimate(waterHeater, "2020", "", "1400").moneyHint).toEqual({
      text: "Enter how many to see a monthly amount.",
      field: "quantity",
      invalid: false,
    });
    expect(estimate(carpet, "2020", "", "4").moneyHint?.text).toBe("Enter the square feet to see a monthly amount.");
    expect(estimate(waterHeater, "2020", "0", "1400").moneyHint).toEqual({
      text: "Enter how many as a number, like 12.",
      field: "quantity",
      invalid: true,
    });
    expect(estimate(carpet, "2020", "lots", "4").moneyHint?.text).toBe("Enter the square feet as a number, like 1200.");
    for (const r of [estimate(waterHeater, "2020", "12", "1.4k"), estimate(waterHeater, "2020", "", "1400")]) {
      expect(r.result).toMatchObject({ due: 2030, monthly: null, neededNow: null, savingFor: null });
    }
  });

  it("needs a cost before anything about money shows", () => {
    expect(estimate(waterHeater, "2020", "12", "")).toMatchObject({ moneyHint: null, result: { monthly: null } });
  });

  it("shows amounts too big to hold as Infinity rather than failing", () => {
    expect(estimate(waterHeater, "2020", "1e200", "1e200").result?.monthly).toBe(Infinity);
  });
});
