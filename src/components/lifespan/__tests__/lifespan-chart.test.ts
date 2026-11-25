import { COMPONENT_LIBRARY, TYPICAL_COSTS, type LibraryComponent } from "@/verticals/landlord";
import { lifespanChartRows, nextLifespanSort, sortLifespanRows, type LifespanChartRow } from "../lifespan-chart";

const rows = lifespanChartRows(COMPONENT_LIBRARY, TYPICAL_COSTS);
const rowIn = (list: LifespanChartRow[], slug: string) => list.find((r) => r.slug === slug)!;
const row = (slug: string) => rowIn(rows, slug);

describe("lifespan chart rows", () => {
  it("keeps library order and each item's life", () => {
    expect(rows.map((r) => r.slug)).toEqual(COMPONENT_LIBRARY.map((c) => c.slug));
    expect(row("tank-water-heater")).toMatchObject({ name: "Tank water heater", category: "Plumbing", lifeLow: 8, lifeHigh: 12 });
  });

  it("gives every built-in item a typical cost and its source", () => {
    for (const r of rows) {
      expect(r.cost).not.toBeNull();
      expect(r.cost!.sources.length).toBeGreaterThan(0);
    }
    expect(row("refrigerator").cost!.sources.map((s) => s.name)).toEqual(["Fixr", "HomeAdvisor"]);
  });

  it("prices items in each apartment per apartment, and floors and paving per sq ft", () => {
    expect(row("tank-water-heater").cost).toMatchObject({ range: "$800–$2,300", per: "per apartment" });
    expect(row("vinyl-windows").cost).toMatchObject({ range: "$3,200–$7,200", per: "per apartment" });
    expect(row("carpet").cost).toMatchObject({ range: "$3–$6", per: "per sq ft" });
    expect(row("parking-lot-seal-coat").cost).toMatchObject({ range: "$0.15–$0.30", per: "per sq ft" });
  });

  it("gives building-wide items a price that doesn't depend on the building's size", () => {
    expect(row("asphalt-shingle-roof").cost).toMatchObject({ range: "$4.50–$8.00", per: "per sq ft of roof, old shingles removed" });
    expect(row("boiler").cost).toMatchObject({ range: "$13,000–$35,000", per: "for a 300,000–600,000 BTU boiler" });
    expect(row("fire-alarm-panel").cost).toMatchObject({ range: "$3,000–$10,000", per: "for a panel, installed and programmed" });
    // Never a 12-unit building's share per apartment, which reads as the price of a whole boiler.
    expect(row("boiler").cost!.per).not.toMatch(/apartment/);
  });

  it("keeps a per-apartment cost edited in the dashboard, which still means the same", () => {
    const edited = TYPICAL_COSTS.map((c) => (c.slug === "dishwasher" ? { ...c, low: 600, high: 1200 } : c));
    expect(rowIn(lifespanChartRows(COMPONENT_LIBRARY, edited), "dishwasher").cost).toMatchObject({
      range: "$600–$1,200",
      per: "per apartment",
    });
  });

  it("leaves out a cost that no longer means what the chart would say", () => {
    // A building-wide item's size-free price comes from the built-in working, which an edit no longer matches.
    const boiler = TYPICAL_COSTS.map((c) => (c.slug === "boiler" ? { ...c, low: 1500 } : c));
    expect(rowIn(lifespanChartRows(COMPONENT_LIBRARY, boiler), "boiler").cost).toBeNull();
    // A per-apartment item whose typical cost became per sq ft.
    const dishwasher = TYPICAL_COSTS.map((c) => (c.slug === "dishwasher" ? { ...c, per: "sq_ft" as const } : c));
    expect(rowIn(lifespanChartRows(COMPONENT_LIBRARY, dishwasher), "dishwasher").cost).toBeNull();
    // A row added in the dashboard without a cost, and no costs at all.
    const added: LibraryComponent = { slug: "pool-pump", category: "Site", name: "Pool pump", lifeLow: 8, lifeHigh: 12, unitLabel: "per_unit" };
    expect(lifespanChartRows([added], TYPICAL_COSTS)[0].cost).toBeNull();
    expect(lifespanChartRows(COMPONENT_LIBRARY, []).every((r) => r.cost === null)).toBe(true);
  });
});

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
