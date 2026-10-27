import { TYPICAL_COSTS, type TypicalCost } from "./typical-costs";

/** A cost guide a typical cost was worked out from. */
export interface CostSource {
  name: string;
  url: string;
}

const HOMEADVISOR = "HomeAdvisor";

/**
 * Where each built-in typical cost comes from, shown next to it in the quick
 * estimate. The figures each page gave and how they became our range are in
 * typical-costs.md. A cost edited in the dashboard keeps its source here until
 * this list is updated.
 */
export const TYPICAL_COST_SOURCES: ReadonlyMap<string, readonly CostSource[]> = new Map([
  ["asphalt-shingle-roof", [{ name: HOMEADVISOR, url: "https://www.homeadvisor.com/cost/roofing/asphalt-shingles-install-replace" }]],
  ["flat-membrane-roof", [{ name: HOMEADVISOR, url: "https://www.homeadvisor.com/cost/roofing/flat-roof" }]],
  ["gutters", [{ name: HOMEADVISOR, url: "https://www.homeadvisor.com/cost/gutters/seamless" }]],
  ["gas-furnace", [{ name: HOMEADVISOR, url: "https://www.homeadvisor.com/cost/heating-and-cooling/install-a-furnace" }]],
  ["central-ac", [{ name: "This Old House", url: "https://www.thisoldhouse.com/heating-cooling/2-ton-ac-unit-cost" }]],
  ["heat-pump", [{ name: HOMEADVISOR, url: "https://www.homeadvisor.com/cost/heating-and-cooling/install-a-heat-pump/" }]],
  ["boiler", [{ name: "OxMaint", url: "https://oxmaint.com/industries/hvac/boiler-replacement-cost-2026-commercial-pricing-btu-fuel-efficiency" }]],
  ["tank-water-heater", [{ name: HOMEADVISOR, url: "https://www.homeadvisor.com/cost/plumbing/install-a-water-heater" }]],
  ["tankless-water-heater", [{ name: HOMEADVISOR, url: "https://www.homeadvisor.com/cost/plumbing/install-a-water-heater" }]],
  [
    "refrigerator",
    [
      { name: "Fixr", url: "https://fixr.com/costs/install-refrigerator" },
      { name: HOMEADVISOR, url: "https://www.homeadvisor.com/cost/kitchens/install-fridge/" },
    ],
  ],
  ["range-oven", [{ name: "HomeServe", url: "https://homeserve.com/en-us/blog/cost-guide/cost-to-switch-to-electric-stove-range-oven" }]],
  ["dishwasher", [{ name: "Bob Vila", url: "https://bobvila.com/articles/dishwasher-installation-cost" }]],
  ["washer-dryer", [{ name: "Fixr", url: "https://www.fixr.com/costs/washer-and-dryer" }]],
  ["carpet", [{ name: "NerdWallet", url: "https://www.nerdwallet.com/home-ownership/home-improvement/learn/cost-to-replace-carpet" }]],
  ["luxury-vinyl-plank", [{ name: "Bob Vila", url: "https://www.bobvila.com/articles/cost-to-install-vinyl-plank-flooring/" }]],
  ["interior-paint", [{ name: "Lula", url: "https://lula.life/articles/make-ready-cost" }]],
  ["kitchen-cabinets", [{ name: HOMEADVISOR, url: "https://www.homeadvisor.com/cost/cabinets/" }]],
  ["laminate-countertops", [{ name: "Fixr", url: "https://www.fixr.com/costs/install-laminate-countertop" }]],
  ["vinyl-windows", [{ name: HOMEADVISOR, url: "https://www.homeadvisor.com/cost/doors-and-windows/window-replacement/" }]],
  ["exterior-paint", [{ name: HOMEADVISOR, url: "https://www.homeadvisor.com/cost/painting/commercial-exterior-painting" }]],
  ["vinyl-siding", [{ name: "NerdWallet", url: "https://www.nerdwallet.com/home-ownership/home-improvement/learn/cost-to-replace-vinyl-siding" }]],
  [
    "parking-lot-seal-coat",
    [
      { name: HOMEADVISOR, url: "https://www.homeadvisor.com/cost/outdoor-living/pave-a-parking-lot" },
      { name: "SealMaster", url: "https://sealmaster.net/faq/much-cost-sealcoat-parking-lot-driveway/" },
    ],
  ],
  ["parking-lot-resurface", [{ name: HOMEADVISOR, url: "https://www.homeadvisor.com/cost/outdoor-living/pave-a-parking-lot" }]],
  ["electrical-panel", [{ name: "NerdWallet", url: "https://www.nerdwallet.com/home-ownership/home-improvement/learn/cost-to-replace-electrical-panel" }]],
  ["fire-alarm-panel", [{ name: "2M Technology", url: "https://www.2mtechnology.net/fire-alarm-installation-cost/" }]],
]);

/**
 * How each built-in typical cost was worked out from its source's figures, shown
 * under it as "Based on ...". Building-wide items are for the 12-unit building in
 * typical-costs.md. Any figure the source doesn't give is marked "our estimate".
 * The parking seal coat is the source's own range, so it has none.
 */
const TYPICAL_COST_BASIS: ReadonlyMap<string, string> = new Map([
  ["asphalt-shingle-roof", "7,000 sq ft of roof × $4.50–$8, old shingles removed, ÷ 12 apartments"],
  ["flat-membrane-roof", "6,000 sq ft of roof × $6–$12, old roof removed, ÷ 12 apartments"],
  ["gutters", "480 ft of gutters and downspouts × $5–$10, including $1 a foot to take the old ones down (our estimate), ÷ 12 apartments"],
  ["gas-furnace", "one small furnace for each apartment"],
  ["central-ac", "one 2-ton system for each apartment"],
  ["heat-pump", "one 2-ton system for each apartment, indoor unit included"],
  ["boiler", "one 300,000–600,000 BTU boiler at $13,000–$35,000, ÷ 12 apartments"],
  ["tank-water-heater", "one 40-gallon heater for each apartment"],
  ["tankless-water-heater", "one for each apartment"],
  ["refrigerator", "a basic 18 cu ft top-freezer at $500–$1,000, plus $200–$300 to install"],
  ["range-oven", "a basic freestanding range at $500–$1,000, plus $100–$300 to install"],
  ["dishwasher", "a basic dishwasher, installed"],
  ["washer-dryer", "a basic top-load washer and dryer, installed"],
  ["carpet", "rental-grade carpet and pad, old carpet removed"],
  ["luxury-vinyl-plank", "floating plank, plus $1–$2 per sq ft to remove the old floor"],
  ["interior-paint", "a 900 sq ft apartment × $2–$4, one standard color"],
  ["kitchen-cabinets", "20 ft of stock cabinets × $100–$300 per ft"],
  ["laminate-countertops", "30 sq ft × $15–$40, plus $50–$300 to remove the old top"],
  ["vinyl-windows", "8 windows × $400–$900"],
  ["exterior-paint", "5,500 sq ft of wall × $2–$6, ÷ 12 apartments"],
  ["vinyl-siding", "5,500 sq ft of wall × $3.50–$7, old siding removed, ÷ 12 apartments"],
  ["parking-lot-resurface", "our estimate for an overlay, which costs less than the $2.50–$4.50 for new paving"],
  ["electrical-panel", "one 100 amp panel for each apartment"],
  ["fire-alarm-panel", "a $1,500–$8,000 panel, plus $1,500–$2,000 to install and program it (our estimate), ÷ 12 apartments"],
]);

/**
 * How a typical cost was worked out, or null. Only while it's still the built-in
 * cost: one edited in the dashboard no longer matches the working.
 */
export function typicalCostBasis(cost: TypicalCost): string | null {
  const builtIn = TYPICAL_COSTS.find((c) => c.slug === cost.slug);
  const unchanged = builtIn !== undefined && builtIn.low === cost.low && builtIn.high === cost.high && builtIn.per === cost.per;
  return unchanged ? (TYPICAL_COST_BASIS.get(cost.slug) ?? null) : null;
}

/**
 * A typical price for a building-wide item that doesn't depend on the building's
 * size: a price per sq ft of roof, or a range for one boiler. Shown in the
 * calculator under a cost for the building, where the per-apartment typical cost
 * (a 12-unit building's shared out) can't be compared. Never used in the math.
 */
export interface BuildingCost {
  low: number;
  high: number;
  /** What the range is for, after it: "per sq ft of roof, old shingles removed". */
  what: string;
}

/**
 * The building-wide items' prices, from the same working as TYPICAL_COST_BASIS
 * (typical-costs.md). Not a whole building's cost: for a duplex that would read
 * like a quote. The fire alarm panel adds its panel and fitting ranges.
 */
const BUILDING_COSTS: ReadonlyMap<string, BuildingCost> = new Map([
  ["asphalt-shingle-roof", { low: 4.5, high: 8, what: "per sq ft of roof, old shingles removed" }],
  ["flat-membrane-roof", { low: 6, high: 12, what: "per sq ft of roof, old roof removed" }],
  ["gutters", { low: 5, high: 10, what: "per foot of gutters and downspouts, old ones removed" }],
  ["boiler", { low: 13000, high: 35000, what: "for a 300,000–600,000 BTU boiler" }],
  ["exterior-paint", { low: 2, high: 6, what: "per sq ft of wall" }],
  ["vinyl-siding", { low: 3.5, high: 7, what: "per sq ft of wall, old siding removed" }],
  ["fire-alarm-panel", { low: 3000, high: 10000, what: "for a panel, installed and programmed" }],
]);

/**
 * The building-wide price for a library item, or null. Only while its typical cost
 * is still the built-in one, as with typicalCostBasis: a cost edited or blanked in
 * the dashboard no longer matches the working.
 */
export function buildingCostOf(slug: string, cost: TypicalCost | undefined): BuildingCost | null {
  if (!cost || cost.slug !== slug || typicalCostBasis(cost) === null) return null;
  return BUILDING_COSTS.get(slug) ?? null;
}

/** Sources for the quick estimate's own assumptions (apartment size and parking). */
export const ASSUMPTION_SOURCES = {
  apartmentSize: { name: "RentCafe", url: "https://www.rentcafe.com/blog/rental-market/real-estate-news/national-average-apartment-size/" },
  parkingSpaces: { name: "Sightline Institute", url: "https://sightline.org/2013/07/23/infographic-living-space-v-parking-space" },
  parkingArea: { name: "Hunker", url: "https://www.hunker.com/13425060/how-to-calculate-the-square-feet-of-pavement-for-parking-spaces" },
} satisfies Record<string, CostSource>;
