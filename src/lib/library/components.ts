import type { UnitLabel } from "@/lib/forecast";

/**
 * Chart categories in fixed color order. Library categories not listed here
 * (and custom components) fold into "Other".
 */
export const CHART_CATEGORIES = [
  "Roofing",
  "HVAC",
  "Plumbing",
  "Appliances",
  "Flooring",
  "Interior",
  "Exterior",
  "Other",
] as const;

export type ChartCategory = (typeof CHART_CATEGORIES)[number];

export interface LibraryComponent {
  slug: string;
  category: string;
  name: string;
  lifeLow: number;
  lifeHigh: number;
  unitLabel: UnitLabel;
}

// Mirrors the component_library seed. Useful-life ranges in years.
export const COMPONENT_LIBRARY: LibraryComponent[] = [
  { slug: "asphalt-shingle-roof", category: "Roofing", name: "Asphalt shingle roof", lifeLow: 20, lifeHigh: 25, unitLabel: "per_building" },
  { slug: "flat-membrane-roof", category: "Roofing", name: "Flat / membrane roof", lifeLow: 15, lifeHigh: 25, unitLabel: "per_building" },
  { slug: "gutters", category: "Roofing", name: "Gutters and downspouts", lifeLow: 20, lifeHigh: 30, unitLabel: "per_building" },
  { slug: "gas-furnace", category: "HVAC", name: "Gas furnace", lifeLow: 15, lifeHigh: 20, unitLabel: "per_unit" },
  { slug: "central-ac", category: "HVAC", name: "Central AC / condenser", lifeLow: 12, lifeHigh: 15, unitLabel: "per_unit" },
  { slug: "heat-pump", category: "HVAC", name: "Heat pump", lifeLow: 12, lifeHigh: 15, unitLabel: "per_unit" },
  { slug: "boiler", category: "HVAC", name: "Boiler", lifeLow: 20, lifeHigh: 30, unitLabel: "per_building" },
  { slug: "tank-water-heater", category: "Plumbing", name: "Tank water heater", lifeLow: 8, lifeHigh: 12, unitLabel: "per_unit" },
  { slug: "tankless-water-heater", category: "Plumbing", name: "Tankless water heater", lifeLow: 15, lifeHigh: 20, unitLabel: "per_unit" },
  { slug: "refrigerator", category: "Appliances", name: "Refrigerator", lifeLow: 10, lifeHigh: 15, unitLabel: "per_unit" },
  { slug: "range-oven", category: "Appliances", name: "Range / oven", lifeLow: 13, lifeHigh: 15, unitLabel: "per_unit" },
  { slug: "dishwasher", category: "Appliances", name: "Dishwasher", lifeLow: 9, lifeHigh: 12, unitLabel: "per_unit" },
  { slug: "washer-dryer", category: "Appliances", name: "Washer / dryer", lifeLow: 10, lifeHigh: 13, unitLabel: "per_unit" },
  { slug: "carpet", category: "Flooring", name: "Carpet", lifeLow: 5, lifeHigh: 10, unitLabel: "per_sq_ft" },
  { slug: "luxury-vinyl-plank", category: "Flooring", name: "Luxury vinyl plank", lifeLow: 15, lifeHigh: 25, unitLabel: "per_sq_ft" },
  { slug: "interior-paint", category: "Interior", name: "Interior paint (turnover)", lifeLow: 3, lifeHigh: 7, unitLabel: "per_unit" },
  { slug: "kitchen-cabinets", category: "Interior", name: "Kitchen cabinets", lifeLow: 20, lifeHigh: 30, unitLabel: "per_unit" },
  { slug: "laminate-countertops", category: "Interior", name: "Laminate countertops", lifeLow: 15, lifeHigh: 20, unitLabel: "per_unit" },
  { slug: "vinyl-windows", category: "Exterior", name: "Windows (vinyl)", lifeLow: 20, lifeHigh: 30, unitLabel: "per_unit" },
  { slug: "exterior-paint", category: "Exterior", name: "Exterior paint", lifeLow: 7, lifeHigh: 10, unitLabel: "per_building" },
  { slug: "vinyl-siding", category: "Exterior", name: "Vinyl siding", lifeLow: 20, lifeHigh: 40, unitLabel: "per_building" },
  { slug: "parking-lot-seal-coat", category: "Site", name: "Parking lot seal coat", lifeLow: 3, lifeHigh: 5, unitLabel: "per_sq_ft" },
  { slug: "parking-lot-resurface", category: "Site", name: "Parking lot resurface", lifeLow: 15, lifeHigh: 20, unitLabel: "per_sq_ft" },
  { slug: "electrical-panel", category: "Electrical", name: "Electrical panel", lifeLow: 25, lifeHigh: 40, unitLabel: "per_unit" },
  { slug: "fire-alarm-panel", category: "Safety", name: "Fire alarm panel", lifeLow: 15, lifeHigh: 20, unitLabel: "per_building" },
];

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
 * building. Sources and assumptions: typical-costs.md, for Kevin to approve.
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

export function defaultLife(item: LibraryComponent): number {
  return Math.round((item.lifeLow + item.lifeHigh) / 2);
}

export function chartCategory(category: string): ChartCategory {
  return (CHART_CATEGORIES as readonly string[]).includes(category)
    ? (category as ChartCategory)
    : "Other";
}

export const UNIT_LABEL_TEXT: Record<UnitLabel, string> = {
  per_unit: "per unit",
  per_building: "per building",
  per_sq_ft: "per sq ft",
};
