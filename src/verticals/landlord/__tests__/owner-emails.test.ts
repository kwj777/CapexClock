import { budgetSummary, reminderKey, remindersDue, savedConditionReport, type SavedReportComponent } from "../owner-emails";
import type { SavedComponent, SavedProperty } from "../property";

const P1: SavedProperty = { id: "p1", name: "Elm St", unit_count: 4, year_built: 2000 };
const P2: SavedProperty = { id: "p2", name: "Oak Ave", unit_count: 0, year_built: 1990 };

function row(id: string, propertyId: string, o: Partial<SavedComponent> = {}): SavedComponent {
  return {
    id,
    property_id: propertyId,
    category: "Plumbing",
    name: `Item ${id}`,
    quantity: 1,
    install_year: 2015,
    useful_life_years: 12,
    replacement_cost_each: 1000,
    scenario: "run_to_failure",
    ...o,
  };
}

const ROWS: SavedComponent[] = [
  row("due", "p1", { name: "Water heater", install_year: 2015, useful_life_years: 12, replacement_cost_each: 1500 }),
  row("late", "p1", { name: "Roof", install_year: 2000, useful_life_years: 20, quantity: 2, replacement_cost_each: 9000 }),
  row("later", "p1", { name: "Furnace", install_year: 2020, useful_life_years: 20 }),
  row("now", "p2", { name: "Carpet", install_year: 2024, useful_life_years: 10, scenario: "replace_now" }),
  row("nocost", "p2", { name: "Fence", install_year: 2000, replacement_cost_each: null }),
];

describe("remindersDue", () => {
  it("lists what is due this year, overdue and replace-now included, overdue first", () => {
    const items = remindersDue([P1, P2], ROWS, 2027, new Set());
    expect(items.map((i) => [i.componentId, i.cost, i.overdue, i.replaceNow])).toEqual([
      ["late", 18000, true, false],
      ["due", 1500, false, false],
      ["now", 1000, false, true],
    ]);
    expect(items[0]).toMatchObject({ propertyId: "p1", propertyName: "Elm St", name: "Roof" });
  });

  it("skips what was already reminded about this year, but not last year", () => {
    const sent = new Set([reminderKey("late", 2027), reminderKey("due", 2026)]);
    expect(remindersDue([P1, P2], ROWS, 2027, sent).map((i) => i.componentId)).toEqual(["due", "now"]);
  });

  it("is empty with nothing due", () => {
    expect(remindersDue([P1], [row("later", "p1", { install_year: 2020, useful_life_years: 20 })], 2027, new Set())).toEqual(
      [],
    );
    expect(remindersDue([], [], 2027, new Set())).toEqual([]);
  });
});

describe("budgetSummary", () => {
  it("budgets the next year, with overdue items counted in it", () => {
    const s = budgetSummary([P1, P2], ROWS, 2027);
    expect(s.budgetYear).toBe(2027);
    const elm = s.properties[0];
    expect(elm).toMatchObject({ propertyId: "p1", name: "Elm St", budgetYearTotal: 19500, atRiskCount: 2, excluded: 0 });
    expect(elm.budgetYearItems).toEqual([
      { name: "Roof", cost: 18000, overdue: true },
      { name: "Water heater", cost: 1500, overdue: false },
    ]);
    expect(elm.monthlyReservePerUnit).toBeCloseTo(elm.monthlyReserve / 4);
    expect(s.properties[1]).toMatchObject({ excluded: 1, componentCount: 2, monthlyReservePerUnit: null });
    expect(s.totals.budgetYearTotal).toBe(20500);
    expect(s.totals.tenYearTotal).toBeCloseTo(s.properties[0].tenYearTotal + s.properties[1].tenYearTotal);
    expect(s.totals.monthlyReserve).toBeCloseTo(s.properties[0].monthlyReserve + s.properties[1].monthlyReserve);
  });
});

describe("savedConditionReport", () => {
  const withReport = (r: SavedComponent, o: Partial<SavedReportComponent> = {}): SavedReportComponent => ({
    ...r,
    unit_label: "per_building",
    condition: null,
    notes: null,
    ...o,
  });

  it("reports on components with a cost and install year", () => {
    const rows = [
      withReport(ROWS[0], { condition: "fair", notes: " Rust at the fittings " }),
      withReport(ROWS[1]),
      withReport(row("x", "p1", { replacement_cost_each: null })),
    ];
    const report = savedConditionReport(P1, rows, 2027)!;
    expect(report).toMatchObject({ propertyName: "Elm St", unitCount: 4, yearBuilt: 2000, excluded: 1, unrated: 1 });
    expect(report.rows.map((r) => [r.name, r.condition, r.notes, r.remainingLife])).toEqual([
      ["Roof", null, "", -7],
      ["Water heater", "fair", "Rust at the fittings", 0],
    ]);
    expect(report.forecast.neededNow).toBe(19500);
    expect(report.components).toHaveLength(2);
  });

  it("is null when nothing can be reported on", () => {
    expect(savedConditionReport(P1, [withReport(row("x", "p1", { replacement_cost_each: null }))], 2027)).toBeNull();
    expect(savedConditionReport({ ...P1, year_built: null }, [], 2027)).toBeNull();
  });
});
