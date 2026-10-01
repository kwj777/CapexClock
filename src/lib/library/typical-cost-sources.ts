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

/** Sources for the quick estimate's own assumptions (apartment size and parking). */
export const ASSUMPTION_SOURCES = {
  apartmentSize: { name: "RentCafe", url: "https://www.rentcafe.com/blog/rental-market/real-estate-news/national-average-apartment-size/" },
  parkingSpaces: { name: "Sightline Institute", url: "https://sightline.org/2013/07/23/infographic-living-space-v-parking-space" },
  parkingArea: { name: "Hunker", url: "https://www.hunker.com/13425060/how-to-calculate-the-square-feet-of-pavement-for-parking-spaces" },
} satisfies Record<string, CostSource>;
