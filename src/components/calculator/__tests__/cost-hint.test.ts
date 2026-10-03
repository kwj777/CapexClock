import {
  COMPONENT_LIBRARY,
  costLabel,
  customRow,
  editRow,
  rowFromLibrary,
  toComponents,
  TYPICAL_COSTS,
  withUnitCount,
  type DraftRow,
} from "@/verticals/landlord";
import { costHint } from "../cost-hint";

const waterHeater = COMPONENT_LIBRARY.find((c) => c.slug === "tank-water-heater")!;
const roof = COMPONENT_LIBRARY.find((c) => c.slug === "asphalt-shingle-roof")!;
const carpet = COMPONENT_LIBRARY.find((c) => c.slug === "carpet")!;

describe("typical cost hints under the cost field", () => {
  const libraryItem = (slug: string) => COMPONENT_LIBRARY.find((c) => c.slug === slug)!;
  const hint = (row: DraftRow) =>
    costHint(row, libraryItem(row.librarySlug!), TYPICAL_COSTS.find((c) => c.slug === row.librarySlug));
  const windows = libraryItem("vinyl-windows");

  it("shows the typical range while the field says per apartment or per sq ft", () => {
    expect(hint(rowFromLibrary(waterHeater, "12"))).toBe("Typical $800–$2,300, use your quote");
    expect(hint(rowFromLibrary(windows, "12"))).toBe("Typical $3,200–$7,200, use your quote");
    expect(hint(rowFromLibrary(carpet, "12"))).toBe("Typical $3–$6, use your quote");
    expect(hint(rowFromLibrary(libraryItem("parking-lot-seal-coat"), "12"))).toBe("Typical $0.15–$0.30, use your quote");
  });

  it("shows none once the owner sets their own count, which makes the field a cost each", () => {
    // 90 windows: the field is now one window's price, about an eighth of an apartment's.
    const ninety = editRow(rowFromLibrary(windows, "12"), { quantity: "90" }, "12");
    expect(costLabel(ninety)).toBe("Cost each");
    expect(hint(ninety)).toBeNull();
  });

  it("shows none for the building, or when the field and the typical cost count different things", () => {
    const roofRow = rowFromLibrary(roof, "12");
    expect(costLabel(roofRow)).toBe("Cost for the building");
    expect(hint(roofRow)).toBeNull();
    // Carpet counted per apartment: the per sq ft range would read as an apartment's cost.
    const carpetPerApartment = editRow(rowFromLibrary(carpet, "12"), { unitLabel: "per_unit" }, "12");
    expect(costLabel(carpetPerApartment)).toBe("Cost per apartment");
    expect(hint(carpetPerApartment)).toBeNull();
  });

  it("shows none for a building-wide item counted per apartment, which most likely means one in each", () => {
    // A boiler's typical cost is a 12-unit building's boiler shared out, a fraction of one in each apartment.
    for (const slug of ["boiler", "fire-alarm-panel", "asphalt-shingle-roof", "vinyl-siding"]) {
      const perApartment = editRow(rowFromLibrary(libraryItem(slug), "12"), { unitLabel: "per_unit" }, "12");
      expect(costLabel(perApartment)).toBe("Cost per apartment");
      expect(hint(perApartment)).toBeNull();
    }
    // Every building-wide item, whatever its count.
    for (const lib of COMPONENT_LIBRARY.filter((c) => c.unitLabel === "per_building")) {
      for (const unitLabel of ["per_unit", "per_building", "per_sq_ft"] as const) {
        expect(hint(editRow(rowFromLibrary(lib, "12"), { unitLabel }, "12"))).toBeNull();
      }
    }
  });

  it("shows none for custom components or library items without a typical cost", () => {
    expect(costHint(customRow(), undefined, undefined)).toBeNull();
    expect(costHint(rowFromLibrary(waterHeater, "12"), waterHeater, undefined)).toBeNull();
  });

  it("follows the field as the unit count changes it", () => {
    const blank = rowFromLibrary(waterHeater, "");
    expect(hint(blank)).not.toBeNull();
    const draft = withUnitCount({ unitCount: "", yearBuilt: "", rows: [blank] }, "14");
    expect(hint(draft.rows[0])).toBe("Typical $800–$2,300, use your quote");
  });

  it("never enters the forecast", () => {
    const row = rowFromLibrary(waterHeater, "12");
    expect(toComponents({ unitCount: "12", yearBuilt: "1998", rows: [row] }, 2026)).toEqual({
      components: [],
      problems: { [row.id]: "missing_cost" },
    });
  });
});
