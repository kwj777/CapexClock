import type { LifespanChartRow } from "../lifespan-chart";
import { nextLifespanSort, sortLifespanRows } from "../lifespan-sort";

describe("sorting the lifespan chart", () => {
  const blank = { cost: null };
  const sample: LifespanChartRow[] = [
    { slug: "b", name: "boiler", category: "HVAC", lifeLow: 20, lifeHigh: 30, ...blank },
    { slug: "a", name: "Attic fan", category: "Roofing", lifeLow: 10, lifeHigh: 15, ...blank },
    { slug: "c", name: "Carpet", category: "Flooring", lifeLow: 5, lifeHigh: 10, ...blank },
    { slug: "d", name: "Dishwasher", category: "Appliances", lifeLow: 10, lifeHigh: 12, ...blank },
    { slug: "e", name: "Exterior paint", category: "HVAC", lifeLow: 20, lifeHigh: 30, ...blank },
  ];
  const order = (list: LifespanChartRow[]) => list.map((r) => r.slug).join("");

  it("keeps library order until a column is chosen", () => {
    expect(order(sortLifespanRows(sample, null))).toBe("bacde");
  });

  it("sorts names A to Z whatever their capitals, and back", () => {
    expect(order(sortLifespanRows(sample, { key: "name", direction: "ascending" }))).toBe("abcde");
    expect(order(sortLifespanRows(sample, { key: "name", direction: "descending" }))).toBe("edcba");
  });

  it("sorts life by the short end, then the long end, with ties in library order both ways", () => {
    expect(order(sortLifespanRows(sample, { key: "life", direction: "ascending" }))).toBe("cdabe");
    expect(order(sortLifespanRows(sample, { key: "life", direction: "descending" }))).toBe("beadc");
  });

  it("sorts categories A to Z, keeping library order within each", () => {
    expect(order(sortLifespanRows(sample, { key: "category", direction: "ascending" }))).toBe("dcbea");
    expect(order(sortLifespanRows(sample, { key: "category", direction: "descending" }))).toBe("abecd");
  });

  it("leaves the rows it's given as they were", () => {
    sortLifespanRows(sample, { key: "name", direction: "descending" });
    expect(order(sample)).toBe("bacde");
  });

  it("sorts ascending first, then flips each time the same heading is chosen", () => {
    const first = nextLifespanSort(null, "life");
    expect(first).toEqual({ key: "life", direction: "ascending" });
    const second = nextLifespanSort(first, "life");
    expect(second).toEqual({ key: "life", direction: "descending" });
    expect(nextLifespanSort(second, "life")).toEqual({ key: "life", direction: "ascending" });
    expect(nextLifespanSort(second, "name")).toEqual({ key: "name", direction: "ascending" });
  });
});
