/**
 * Editorial notes for the /lifespan pages. General guidance only: it describes
 * what commonly shortens or extends a component's life and what owners
 * typically notice near the end, not a substitute for an inspection (the pages
 * say so too).
 */
export interface LifespanNotes {
  factors: string[];
  /** Wear to plan and budget for. Hazards go in safety, never here. */
  signs: string[];
  /** A hazard that needs a licensed pro now, not a savings plan. Shown first, set apart. */
  safety?: string;
  /** What being in a rental changes: tenants, turnover, liability. */
  rental?: string;
  /** When a repair is enough and when it's time to replace. General guidance, not a quote. */
  repairOrReplace?: string;
}

export const LIFESPAN_NOTES: Record<string, LifespanNotes> = {
  "asphalt-shingle-roof": {
    factors: ["Attic ventilation: trapped heat ages shingles from below", "Sun and heat exposure, especially on south- and west-facing slopes", "Shingle grade (3-tab vs. architectural)", "Installation quality and flashing details"],
    signs: ["Curling, cupping or missing shingles", "Heavy granule loss in gutters", "Recurring leaks around flashing or valleys", "Visible sagging in the roof deck"],
    rental: "A roof doesn't wear faster because of tenants, but a leak in a rental is found later: nobody in the attic, and a tenant may live with a stain for months. Ask tenants to report ceiling stains, and look at the roof after big storms.",
    repairOrReplace: "Missing shingles, a flashing leak or storm damage on a roof with years left is a repair. When leaks keep coming back, granules are washing off everywhere and the roof is near the end of its range, patching only buys time, and a second layer over old shingles usually isn't worth it.",
  },
  "flat-membrane-roof": {
    factors: ["Membrane type (TPO, EPDM, modified bitumen, built-up)", "Ponding water from poor drainage", "Foot traffic from rooftop equipment service", "UV exposure and seam quality"],
    signs: ["Blisters, splits or open seams", "Standing water days after rain", "Leaks that return after patching", "Wet or compressed insulation underneath"],
    rental: "Rooftop HVAC units on apartment buildings bring service techs onto the membrane, and their foot traffic and dropped tools cause many of the punctures. Walkway pads to the equipment help.",
    repairOrReplace: "Seams and small punctures can be patched or coated for years. When leaks return after patching, insulation underneath is wet, or a large share of the roof needs work, replacing is usually the better buy.",
  },
  gutters: {
    factors: ["Material (aluminum, steel, vinyl, copper)", "How often debris is cleared", "Ice and snow loads", "Secure fastening to the fascia"],
    signs: ["Sagging runs or pulled-away hangers", "Rust, cracks or leaking seams", "Water overflowing onto siding or foundations", "Peeling paint or rot on the fascia behind"],
    rental: "Clogged gutters on a rental cause damage the tenant never sees: water against the foundation, rotting fascia, ice dams. Put cleaning on a schedule rather than waiting for a complaint.",
    repairOrReplace: "Loose hangers, leaking seams and a bent section are cheap fixes. Replace when rust, cracks and sagging are spread along the runs, or when the fascia behind them has to be replaced anyway.",
  },
  "gas-furnace": {
    factors: ["Filter changes: clogged filters strain the blower and heat exchanger", "Annual service and cleaning", "Correct sizing for the unit", "Climate and hours of use"],
    signs: ["Rising repair calls, especially ignition and blower parts", "Uneven heat or short cycling", "Climbing gas use for the same comfort", "Parts getting hard to find for an older model"],
    safety: "A cracked heat exchanger can leak carbon monoxide. If a CO alarm goes off or you smell gas, get everyone outside and call 911. If a technician finds a crack, shut the furnace off and call a licensed HVAC pro now.",
    rental: "Tenants rarely change filters on time, and a clogged filter is one of the most common reasons a furnace works harder and fails early. Change filters on a schedule yourself, or at every inspection.",
    repairOrReplace: "Igniters, flame sensors and blower motors are routine repairs. A common rule of thumb: if a repair costs more than about half the price of a new furnace and the furnace is past the middle of its life, replace it. A cracked heat exchanger usually means replacement.",
  },
  "central-ac": {
    factors: ["Coil cleaning and filter changes", "Coastal salt air or heavy dust", "Correct refrigerant charge", "Runtime in hot climates"],
    signs: ["Longer run times and weaker cooling", "Refrigerant leaks or compressor trouble", "Obsolete refrigerant making repairs costly", "Louder, rougher running as parts wear"],
    safety: "A breaker that keeps tripping, a burning smell or scorched wires at the unit are fire risks. Don't keep resetting the breaker. Turn the AC off and call a licensed HVAC pro now.",
    rental: "A no-cooling call in summer is urgent in a rental, so a failing unit costs more than its repair: emergency rates, possible hotel or portable AC costs, and an unhappy tenant. Plan replacements for the off-season.",
    repairOrReplace: "Capacitors, contactors and fan motors are cheap repairs. A failed compressor or a large refrigerant leak on an older system often costs a big share of a new one; at that point, and with an obsolete refrigerant, replacing is usually the better buy.",
  },
  "heat-pump": {
    factors: ["Year-round runtime (it heats and cools)", "Coil and filter maintenance", "Defrost performance in cold climates", "Correct sizing and refrigerant charge"],
    signs: ["Heavy use of backup heat strips", "Compressor or reversing-valve failures", "Ice build-up that doesn't clear", "Rising electric bills"],
    rental: "A heat pump runs in both seasons, so it piles up hours faster than a furnace or AC alone, and tenants may lean on emergency heat without knowing it costs more. Check the thermostat settings at turnover.",
    repairOrReplace: "Fan motors, capacitors and defrost controls are repairs. A failed compressor or reversing valve on a unit near the end of its range usually tips the decision to replacement, often for a more efficient model.",
  },
  boiler: {
    factors: ["Water treatment and annual flushing", "Cast-iron vs. steel vs. high-efficiency condensing design", "Short cycling from oversizing", "Service of burners and controls"],
    signs: ["Leaks at sections or the heat exchanger", "More frequent repairs to pumps and controls", "Rising fuel use", "Parts that are hard to source"],
    safety: "A gas or oil boiler can leak carbon monoxide. If a CO alarm goes off or you smell gas, get everyone outside and call 911. If you see soot, a yellow, flickering flame or a relief valve that drips or sprays, shut the boiler off and call a licensed pro now.",
    rental: "One boiler heats every apartment, so a failure in winter is a building-wide emergency. Annual service and a relationship with a boiler company before you need one matter more here than with any single-unit system.",
    repairOrReplace: "Pumps, valves and controls are routine repairs that keep an older boiler going for years. Leaking sections or a failed heat exchanger on an old boiler usually mean it's time to replace, ideally planned for summer.",
  },
  "tank-water-heater": {
    factors: ["Water hardness: sediment builds up in the tank", "Flushing the tank and checking the anode rod", "Temperature setting and demand", "Installation in unheated spaces"],
    signs: ["Rusty or discolored hot water", "Rumbling or popping from sediment", "Moisture or a slow leak at the base", "Hot water running out sooner than it used to"],
    safety: "If a CO alarm goes off or you smell gas, get everyone outside and call 911. If the relief valve drips or sprays, or you see soot around a gas heater, turn the heater off and call a licensed plumber now.",
    rental: "A failed tank in a rental often means water damage below it as well as the heater, especially in upstairs units or closets. Drain pans, leak sensors and replacing near the end of the range are cheaper than the ceiling below.",
    repairOrReplace: "Elements, thermostats, gas valves and anode rods can be replaced. A leaking tank can't be repaired: once the tank itself leaks, replace it.",
  },
  "tankless-water-heater": {
    factors: ["Descaling in hard-water areas", "Venting and combustion-air quality", "Inlet filter cleaning", "Correct sizing for peak demand"],
    signs: ["Error codes and ignition failures", "Temperature swings during use", "Scale-related flow restrictions", "Heat exchanger leaks"],
    safety: "If a CO alarm goes off or you smell gas, get everyone outside and call 911. On a gas model, soot at the vent or a burning smell can mean carbon monoxide. Turn the heater off and call a licensed pro now.",
    rental: "Hard water is the main enemy, and descaling is easy to forget in a rental. Put it on the maintenance calendar, typically once a year in hard-water areas.",
    repairOrReplace: "Sensors, igniters, fans and flow parts can usually be repaired. A leaking heat exchanger on an older unit is often expensive enough that replacement makes more sense.",
  },
  refrigerator: {
    factors: ["Coil cleaning", "Door gasket condition", "Placement near heat sources", "Tenant use and moves"],
    signs: ["Food not staying cold", "Compressor running constantly", "Frost build-up or water leaks", "Repairs approaching the cost of a new unit"],
    rental: "Tenants move furniture and appliances, and gaskets and handles take a beating at move-in and move-out. A refrigerator failure also means spoiled food a tenant may ask you to cover.",
    repairOrReplace: "Gaskets, fans, thermostats and ice makers are repairs. When the compressor or sealed system fails on an older unit, a basic replacement usually costs about the same as the repair.",
  },
  "range-oven": {
    factors: ["Gas vs. electric", "Cleaning between tenants", "Igniter and element wear", "Control board failures"],
    signs: ["Uneven or unreliable heating", "Failed igniters or burners", "Broken controls or door seals", "Hard-to-find parts"],
    safety: "If you smell gas near a gas range, don't light it or flip any switches. Get everyone out and call 911 or the gas company from outside.",
    rental: "Cleaning between tenants is when most damage is found: broken knobs, cracked glass, burned-out elements. Keep a few common parts for the model you standardize on.",
    repairOrReplace: "Igniters, elements, knobs and door seals are cheap repairs. A failed control board on an older range can cost a large share of a basic new one, which is usually the point to replace.",
  },
  dishwasher: {
    factors: ["Water hardness", "Filter cleaning", "Tenant use", "Pump and seal wear"],
    signs: ["Dishes not coming clean", "Leaks under the unit", "Water left standing in the tub", "Rust on racks or the tub"],
    rental: "A slow leak under a dishwasher can rot the subfloor and cabinet before a tenant notices. Check under the sink and around the unit at every turnover.",
    repairOrReplace: "Pumps, door seals and spray arms are repairs. Replace when the tub rusts through or leaks, or when a repair approaches the cost of a basic new unit, which is often the case for dishwashers.",
  },
  "washer-dryer": {
    factors: ["Shared laundry vs. in-unit use", "Dryer vent cleaning", "Overloading", "Level installation"],
    signs: ["Excess vibration or noise", "Leaks or drainage problems", "Frequent repair calls", "Repairs approaching the cost of a new machine"],
    safety: "Long drying times usually mean a clogged dryer vent, a common cause of dryer fires. Clean the vent now, before you decide the dryer is failing.",
    rental: "Shared laundry machines run far more cycles than a household's, so they wear out sooner than the same model at home. In-unit machines depend on how each tenant treats them.",
    repairOrReplace: "Belts, pumps, door switches and heating elements are repairs. Replace when repairs keep coming or one would cost close to a basic new machine. Always clean the dryer vent before blaming the dryer.",
  },
  carpet: {
    factors: ["Tenant turnover and foot traffic", "Pet use", "Carpet and pad quality", "Regular professional cleaning"],
    signs: ["Worn traffic paths", "Stains and odors that don't clean out", "Seams separating or ripples", "Pad breakdown you can feel underfoot"],
    rental: "Carpet is the item tenants wear out fastest: pets, traffic paths and stains decide its life more than its age. Many owners replace it at turnover when a deep clean no longer brings it back.",
    repairOrReplace: "Stretching, seam repair and patching small areas extend its life. Replace when traffic paths are worn through, stains and odors stay after cleaning, or the pad has broken down.",
  },
  "luxury-vinyl-plank": {
    factors: ["Wear-layer thickness", "Subfloor flatness", "Moisture and sunlight exposure", "Furniture pads and grit control"],
    signs: ["Scratches through the wear layer", "Gapping or lifting planks", "Fading in sunny rooms", "Damaged planks that no longer match replacements"],
    rental: "Plank holds up well to tenants and pets, which is why many owners switch to it from carpet. Keep a box of spare planks from the same lot, since matching later is hard.",
    repairOrReplace: "Damaged planks can be swapped out one at a time on most floating floors. Replace the floor when the wear layer is gone across traffic areas or water has damaged the subfloor.",
  },
  "interior-paint": {
    factors: ["Length of tenancy", "Paint sheen and quality", "Kitchen and bath humidity", "Pets and children"],
    signs: ["Scuffs and marks that don't wash off", "Patchy touch-ups", "Peeling in bathrooms", "Color changes needed at turnover"],
    rental: "In a rental, paint is usually redone at turnover rather than when it wears out, and how long a tenant stays matters more than the paint's age. Using one standard color makes touch-ups and turnovers faster.",
    repairOrReplace: "Touch-ups work for small scuffs when the paint is recent and the same color. After a long tenancy, smoking or pets, or when touch-ups no longer blend, repaint the room.",
  },
  "kitchen-cabinets": {
    factors: ["Box material (plywood vs. particleboard)", "Water leaks under sinks", "Hinge and drawer hardware quality", "Tenant care"],
    signs: ["Swollen or delaminating panels", "Doors that won't stay aligned", "Broken drawer boxes", "Water damage in sink bases"],
    rental: "Water under the sink is the most common cause of ruined cabinets in rentals, often from a slow drain leak nobody reported. Check sink bases at every turnover.",
    repairOrReplace: "Hinges, drawer slides, doors and even a single sink base can be replaced. Refacing or painting updates sound boxes. Replace the run when boxes are swollen, delaminating or water-damaged.",
  },
  "laminate-countertops": {
    factors: ["Seams near sinks", "Heat and knife damage", "Water getting under the edges", "Tenant care"],
    signs: ["Swelling at seams or around the sink", "Chips and burns", "Lifting edges", "Stains that don't come out"],
    rental: "Tenants put hot pans and knives straight on laminate, and water at the sink seam does the most damage. A good sink seal and caulk at every turnover help.",
    repairOrReplace: "Small chips and loose edges can be fixed, but swelling at seams and burns can't be undone. Laminate is inexpensive, so replacing is usually better than extensive repairs.",
  },
  "vinyl-windows": {
    factors: ["Sun exposure", "Seal and glazing quality", "Installation and flashing", "Operating hardware wear"],
    signs: ["Fogging between panes (failed seals)", "Drafts and condensation", "Windows that won't open, close or lock", "Cracked frames or sashes"],
    rental: "Tenants report drafts and condensation but rarely failed seals or broken locks until they matter. Locks and latches that don't work can also be a safety and code issue in a rental.",
    repairOrReplace: "Locks, balances, cranks and weatherstripping can be repaired, and a fogged pane can often be replaced without the frame. Replace the window when frames are cracked or warped, or many seals have failed.",
  },
  "exterior-paint": {
    factors: ["Surface prep before painting", "Sun and weather exposure", "Siding material", "Paint quality and number of coats"],
    signs: ["Peeling, cracking or chalking", "Bare wood showing", "Fading on sunny walls", "Mildew staining"],
    rental: "Peeling paint on a rental is the first thing a prospective tenant sees. Older buildings may have lead paint under the current coat, which changes how the prep has to be done.",
    repairOrReplace: "Touching up the sunniest walls and trim can stretch a full repaint. When paint is peeling or bare wood is showing over large areas, repaint before the siding itself is damaged.",
  },
  "vinyl-siding": {
    factors: ["Sun and temperature swings", "Impact damage", "Installation (room to expand and contract)", "Product thickness"],
    signs: ["Cracked or warped panels", "Loose or missing pieces", "Heavy fading", "Moisture problems behind the siding"],
    rental: "Siding mostly suffers from impacts: lawn equipment, grills on patios, cars in parking areas. Keep a few spare panels from the original run for repairs.",
    repairOrReplace: "Cracked or loose panels can be replaced one at a time if you can match them. Replace when fading, warping and cracking are widespread, or water is getting behind it.",
  },
  "parking-lot-seal-coat": {
    factors: ["Traffic volume", "Sun and freeze-thaw cycles", "Oil and fuel spills", "Crack filling before sealing"],
    signs: ["Gray, faded asphalt", "Surface raveling and loose stones", "Small cracks opening up", "Water soaking in instead of running off"],
    rental: "Tenant cars leak oil and fuel in the same spots, which breaks down asphalt faster there. Clean oil spots before sealing.",
    repairOrReplace: "Seal coating is itself the maintenance that delays resurfacing. Fill cracks first. Once the surface is cracking structurally, seal coat won't fix it.",
  },
  "parking-lot-resurface": {
    factors: ["Base and drainage quality", "Heavy vehicles such as trash trucks", "Keeping up with seal coating and crack filling", "Freeze-thaw cycles"],
    signs: ["Alligator cracking", "Potholes that return after patching", "Standing water and depressions", "Base failure under wheel paths"],
    rental: "Trash trucks and moving trucks are the heaviest loads on an apartment lot, and their routes usually fail first. Potholes are also a trip and liability risk with tenants.",
    repairOrReplace: "Crack filling, patching and seal coating extend a lot's life. When alligator cracking, potholes and standing water are widespread, an overlay or full repaving costs less than chasing failures.",
  },
  "electrical-panel": {
    factors: ["Panel brand and model history", "Capacity versus modern loads", "Moisture and corrosion", "Loose connections"],
    signs: ["Insurance or lender questions about the panel", "No room for new circuits", "Not enough capacity for new appliances or AC", "Replacement breakers that are hard to find"],
    safety: "Breakers that feel warm or keep tripping, scorch marks, rust or water in the panel, buzzing or a burning smell are fire risks. Call a licensed electrician now.",
    rental: "Tenants add more electric load over time: space heaters, window AC, EV chargers. Insurers and lenders may also ask about older panel brands in rentals.",
    repairOrReplace: "Individual breakers can be replaced if parts are available. Replace the panel when it's a brand known for problems, breakers are no longer made, it's out of capacity, or a licensed electrician recommends it.",
  },
  "fire-alarm-panel": {
    factors: ["Manufacturer support and parts availability", "Code changes in your area", "Testing and service contracts", "Battery and power supply maintenance"],
    signs: ["Frequent false alarms", "Discontinued parts or no manufacturer support", "Failed inspections", "Code changes the panel can't meet"],
    safety: "A trouble signal or a device that drops off the panel means part of the system may not work in a fire. Call your fire alarm company to fix it now.",
    rental: "A fire alarm system in a multifamily building is usually subject to required inspections, and a failed panel can put the building out of compliance. Your fire alarm company and local code decide much of the timing.",
    repairOrReplace: "Batteries, devices and modules are routinely replaced. Replace the panel when the manufacturer no longer supports it, parts are discontinued, or it can't meet current code.",
  },
};

/** The notes for a slug, if any. Own keys only, so a slug like "constructor" finds nothing. */
export function notesFor(slug: string): LifespanNotes | undefined {
  return Object.prototype.hasOwnProperty.call(LIFESPAN_NOTES, slug) ? LIFESPAN_NOTES[slug] : undefined;
}
