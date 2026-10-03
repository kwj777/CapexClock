import type { UnitLabel } from "../units";

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

export function defaultLife(item: LibraryComponent): number {
  return Math.round((item.lifeLow + item.lifeHigh) / 2);
}

export function chartCategory(category: string): ChartCategory {
  return (CHART_CATEGORIES as readonly string[]).includes(category)
    ? (category as ChartCategory)
    : "Other";
}
