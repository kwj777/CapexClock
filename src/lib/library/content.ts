/**
 * Editorial notes for the /lifespan pages. General guidance only: it describes
 * what commonly shortens or extends a component's life and what owners
 * typically notice near the end, not a substitute for an inspection.
 */
export interface LifespanNotes {
  factors: string[];
  signs: string[];
}

export const LIFESPAN_NOTES: Record<string, LifespanNotes> = {
  "asphalt-shingle-roof": {
    factors: ["Attic ventilation: trapped heat ages shingles from below", "Sun and heat exposure, especially on south- and west-facing slopes", "Shingle grade (3-tab vs. architectural)", "Installation quality and flashing details"],
    signs: ["Curling, cupping or missing shingles", "Heavy granule loss in gutters", "Recurring leaks around flashing or valleys", "Visible sagging in the roof deck"],
  },
  "flat-membrane-roof": {
    factors: ["Membrane type (TPO, EPDM, modified bitumen, built-up)", "Ponding water from poor drainage", "Foot traffic from rooftop equipment service", "UV exposure and seam quality"],
    signs: ["Blisters, splits or open seams", "Standing water days after rain", "Leaks that return after patching", "Wet or compressed insulation underneath"],
  },
  gutters: {
    factors: ["Material (aluminum, steel, vinyl, copper)", "How often debris is cleared", "Ice and snow loads", "Secure fastening to the fascia"],
    signs: ["Sagging runs or pulled-away hangers", "Rust, cracks or leaking seams", "Water overflowing onto siding or foundations", "Peeling paint or rot on the fascia behind"],
  },
  "gas-furnace": {
    factors: ["Filter changes: clogged filters strain the blower and heat exchanger", "Annual service and cleaning", "Correct sizing for the unit", "Climate and hours of use"],
    signs: ["Rising repair calls, especially ignition and blower parts", "Uneven heat or short cycling", "Rust or cracks on the heat exchanger", "Climbing gas use for the same comfort"],
  },
  "central-ac": {
    factors: ["Coil cleaning and filter changes", "Coastal salt air or heavy dust", "Correct refrigerant charge", "Runtime in hot climates"],
    signs: ["Longer run times and weaker cooling", "Refrigerant leaks or compressor trouble", "Obsolete refrigerant making repairs costly", "Loud operation or frequent breaker trips"],
  },
  "heat-pump": {
    factors: ["Year-round runtime (it heats and cools)", "Coil and filter maintenance", "Defrost performance in cold climates", "Correct sizing and refrigerant charge"],
    signs: ["Heavy use of backup heat strips", "Compressor or reversing-valve failures", "Ice build-up that doesn't clear", "Rising electric bills"],
  },
  boiler: {
    factors: ["Water treatment and annual flushing", "Cast-iron vs. steel vs. high-efficiency condensing design", "Short cycling from oversizing", "Service of burners and controls"],
    signs: ["Leaks at sections or the heat exchanger", "Frequent pressure or pilot problems", "Rising fuel use", "Parts that are hard to source"],
  },
  "tank-water-heater": {
    factors: ["Water hardness: sediment builds up in the tank", "Flushing the tank and checking the anode rod", "Temperature setting and demand", "Installation in unheated spaces"],
    signs: ["Rusty or discolored hot water", "Rumbling or popping from sediment", "Moisture or a slow leak at the base", "Hot water running out sooner than it used to"],
  },
  "tankless-water-heater": {
    factors: ["Descaling in hard-water areas", "Venting and combustion-air quality", "Inlet filter cleaning", "Correct sizing for peak demand"],
    signs: ["Error codes and ignition failures", "Temperature swings during use", "Scale-related flow restrictions", "Heat exchanger leaks"],
  },
  refrigerator: {
    factors: ["Coil cleaning", "Door gasket condition", "Placement near heat sources", "Tenant use and moves"],
    signs: ["Food not staying cold", "Compressor running constantly", "Frost build-up or water leaks", "Repairs approaching the cost of a new unit"],
  },
  "range-oven": {
    factors: ["Gas vs. electric", "Cleaning between tenants", "Igniter and element wear", "Control board failures"],
    signs: ["Uneven or unreliable heating", "Failed igniters or burners", "Broken controls or door seals", "Hard-to-find parts"],
  },
  dishwasher: {
    factors: ["Water hardness", "Filter cleaning", "Tenant use", "Pump and seal wear"],
    signs: ["Dishes not coming clean", "Leaks under the unit", "Water left standing in the tub", "Rust on racks or the tub"],
  },
  "washer-dryer": {
    factors: ["Shared laundry vs. in-unit use", "Dryer vent cleaning", "Overloading", "Level installation"],
    signs: ["Excess vibration or noise", "Leaks or drainage problems", "Long drying times", "Frequent repair calls"],
  },
  carpet: {
    factors: ["Tenant turnover and foot traffic", "Pet use", "Carpet and pad quality", "Regular professional cleaning"],
    signs: ["Worn traffic paths", "Stains and odors that don't clean out", "Seams separating or ripples", "Pad breakdown you can feel underfoot"],
  },
  "luxury-vinyl-plank": {
    factors: ["Wear-layer thickness", "Subfloor flatness", "Moisture and sunlight exposure", "Furniture pads and grit control"],
    signs: ["Scratches through the wear layer", "Gapping or lifting planks", "Fading in sunny rooms", "Damaged planks that no longer match replacements"],
  },
  "interior-paint": {
    factors: ["Length of tenancy", "Paint sheen and quality", "Kitchen and bath humidity", "Pets and children"],
    signs: ["Scuffs and marks that don't wash off", "Patchy touch-ups", "Peeling in bathrooms", "Color changes needed at turnover"],
  },
  "kitchen-cabinets": {
    factors: ["Box material (plywood vs. particleboard)", "Water leaks under sinks", "Hinge and drawer hardware quality", "Tenant care"],
    signs: ["Swollen or delaminating panels", "Doors that won't stay aligned", "Broken drawer boxes", "Water damage in sink bases"],
  },
  "laminate-countertops": {
    factors: ["Seams near sinks", "Heat and knife damage", "Water getting under the edges", "Tenant care"],
    signs: ["Swelling at seams or around the sink", "Chips and burns", "Lifting edges", "Stains that don't come out"],
  },
  "vinyl-windows": {
    factors: ["Sun exposure", "Seal and glazing quality", "Installation and flashing", "Operating hardware wear"],
    signs: ["Fogging between panes (failed seals)", "Drafts and condensation", "Windows that won't open, close or lock", "Cracked frames or sashes"],
  },
  "exterior-paint": {
    factors: ["Surface prep before painting", "Sun and weather exposure", "Siding material", "Paint quality and number of coats"],
    signs: ["Peeling, cracking or chalking", "Bare wood showing", "Fading on sunny walls", "Mildew staining"],
  },
  "vinyl-siding": {
    factors: ["Sun and temperature swings", "Impact damage", "Installation (room to expand and contract)", "Product thickness"],
    signs: ["Cracked or warped panels", "Loose or missing pieces", "Heavy fading", "Moisture problems behind the siding"],
  },
  "parking-lot-seal-coat": {
    factors: ["Traffic volume", "Sun and freeze-thaw cycles", "Oil and fuel spills", "Crack filling before sealing"],
    signs: ["Gray, faded asphalt", "Surface raveling and loose stones", "Small cracks opening up", "Water soaking in instead of running off"],
  },
  "parking-lot-resurface": {
    factors: ["Base and drainage quality", "Heavy vehicles such as trash trucks", "Keeping up with seal coating and crack filling", "Freeze-thaw cycles"],
    signs: ["Alligator cracking", "Potholes that return after patching", "Standing water and depressions", "Base failure under wheel paths"],
  },
  "electrical-panel": {
    factors: ["Panel brand and model history", "Capacity versus modern loads", "Moisture and corrosion", "Loose connections"],
    signs: ["Breakers that trip often or feel warm", "Rust or scorch marks", "Insurance or lender questions about the panel", "No room for new circuits"],
  },
  "fire-alarm-panel": {
    factors: ["Manufacturer support and parts availability", "Code changes in your area", "Testing and service contracts", "Battery and power supply maintenance"],
    signs: ["Frequent trouble signals or false alarms", "Discontinued parts", "Failed inspections", "Devices that no longer talk to the panel"],
  },
};
