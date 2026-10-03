/** What one typical cost pays for: one apartment's worth, or one square foot. */
export type TypicalCostPer = "apartment" | "sq_ft";

/**
 * A typical installed replacement cost in today's dollars, from a basic job (low)
 * to a typical upper end (high). Only ever shown as a hint or used in the quick
 * estimate, never in a property's forecast.
 */
export interface TypicalCost {
  slug: string;
  low: number;
  high: number;
  per: TypicalCostPer;
}

/**
 * Mirrors the typical costs in supabase/migrations/0005_typical_costs.sql and the
 * seed (a test keeps them in sync). Items in each apartment and building-wide
 * items are both priced per apartment; building-wide ones for a 12-unit, two-story
 * building. Sources and assumptions: typical-costs.md, approved by Kevin on October 2, 2026.
 */
export const TYPICAL_COSTS: TypicalCost[] = [
  { slug: "asphalt-shingle-roof", low: 2600, high: 4700, per: "apartment" },
  { slug: "flat-membrane-roof", low: 3000, high: 6000, per: "apartment" },
  { slug: "gutters", low: 200, high: 400, per: "apartment" },
  { slug: "gas-furnace", low: 2500, high: 5000, per: "apartment" },
  { slug: "central-ac", low: 3500, high: 6500, per: "apartment" },
  { slug: "heat-pump", low: 4000, high: 7000, per: "apartment" },
  { slug: "boiler", low: 1100, high: 2900, per: "apartment" },
  { slug: "tank-water-heater", low: 800, high: 2300, per: "apartment" },
  { slug: "tankless-water-heater", low: 1400, high: 3900, per: "apartment" },
  { slug: "refrigerator", low: 700, high: 1300, per: "apartment" },
  { slug: "range-oven", low: 600, high: 1300, per: "apartment" },
  { slug: "dishwasher", low: 500, high: 1100, per: "apartment" },
  { slug: "washer-dryer", low: 900, high: 2000, per: "apartment" },
  { slug: "carpet", low: 3, high: 6, per: "sq_ft" },
  { slug: "luxury-vinyl-plank", low: 4, high: 8, per: "sq_ft" },
  { slug: "interior-paint", low: 1800, high: 3600, per: "apartment" },
  { slug: "kitchen-cabinets", low: 2000, high: 6000, per: "apartment" },
  { slug: "laminate-countertops", low: 500, high: 1500, per: "apartment" },
  { slug: "vinyl-windows", low: 3200, high: 7200, per: "apartment" },
  { slug: "exterior-paint", low: 900, high: 2800, per: "apartment" },
  { slug: "vinyl-siding", low: 1600, high: 3200, per: "apartment" },
  { slug: "parking-lot-seal-coat", low: 0.15, high: 0.3, per: "sq_ft" },
  { slug: "parking-lot-resurface", low: 2, high: 4, per: "sq_ft" },
  { slug: "electrical-panel", low: 1000, high: 2500, per: "apartment" },
  { slug: "fire-alarm-panel", low: 250, high: 850, per: "apartment" },
];
