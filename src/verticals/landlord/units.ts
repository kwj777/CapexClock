/** How a library item is counted and priced. Mirrors the database's unit_label. */
export type UnitLabel = "per_unit" | "per_building" | "per_sq_ft";

export const UNIT_LABEL_TEXT: Record<UnitLabel, string> = {
  per_unit: "per unit",
  per_building: "per building",
  per_sq_ft: "per sq ft",
};
