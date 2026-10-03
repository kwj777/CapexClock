import { newRowId } from "./ids";
import { quantityMatchesUnits, type Draft, type DraftRow } from "./model";

/** A small 12-unit example so first-time visitors can see a forecast immediately. */
export function exampleDraft(): Draft {
  const row = (r: Omit<DraftRow, "id" | "scenario" | "followsUnitCount">): DraftRow => ({
    ...r,
    id: newRowId(),
    scenario: "run_to_failure",
    followsUnitCount: quantityMatchesUnits(r, "12"),
  });
  return {
    unitCount: "12",
    yearBuilt: "1998",
    rows: [
      row({ librarySlug: "asphalt-shingle-roof", category: "Roofing", name: "Asphalt shingle roof", quantity: "1", unitLabel: "per_building", installYear: "2008", usefulLife: "22", costEach: "38000" }),
      row({ librarySlug: "gas-furnace", category: "HVAC", name: "Gas furnace", quantity: "12", unitLabel: "per_unit", installYear: "2012", usefulLife: "18", costEach: "4200" }),
      row({ librarySlug: "tank-water-heater", category: "Plumbing", name: "Tank water heater", quantity: "12", unitLabel: "per_unit", installYear: "2016", usefulLife: "10", costEach: "1400" }),
      row({ librarySlug: "refrigerator", category: "Appliances", name: "Refrigerator", quantity: "12", unitLabel: "per_unit", installYear: "", usefulLife: "13", costEach: "1100" }),
      row({ librarySlug: "carpet", category: "Flooring", name: "Carpet", quantity: "9600", unitLabel: "per_sq_ft", installYear: "2020", usefulLife: "8", costEach: "4" }),
      row({ librarySlug: "parking-lot-seal-coat", category: "Site", name: "Parking lot seal coat", quantity: "8000", unitLabel: "per_sq_ft", installYear: "2023", usefulLife: "4", costEach: "0.25" }),
    ],
  };
}
