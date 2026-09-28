import { COMPONENT_LIBRARY, type LibraryComponent } from "../components";
import { notesFor } from "../content";
import {
  categoryAsModifier,
  inSentence,
  lifeDrivers,
  lifespanDescription,
  lifespanTitle,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  subjectFor,
  titleCase,
} from "../phrasing";

const bySlug = (s: string) => COMPONENT_LIBRARY.find((c) => c.slug === s)!;
const added = (name: string, category = "Other"): LibraryComponent => ({
  slug: "new-thing",
  category,
  name,
  lifeLow: 20,
  lifeHigh: 30,
  unitLabel: "per_building",
});

describe("subjectFor", () => {
  it("picks an/a and handles plurals", () => {
    expect(subjectFor(bySlug("asphalt-shingle-roof")).noun).toBe("an asphalt shingle roof");
    expect(subjectFor(bySlug("tank-water-heater")).noun).toBe("a tank water heater");
    expect(subjectFor(bySlug("vinyl-windows"))).toEqual({ noun: "vinyl windows", plural: true });
    expect(subjectFor(bySlug("kitchen-cabinets"))).toEqual({ noun: "kitchen cabinets", plural: true });
    expect(subjectFor(bySlug("carpet"))).toEqual({ noun: "carpet", plural: false });
    expect(subjectFor(bySlug("interior-paint"))).toEqual({ noun: "interior paint", plural: false });
    expect(subjectFor(bySlug("range-oven")).noun).toBe("a range or oven");
  });

  it("never leaves slashes or parentheses in a sentence", () => {
    for (const c of COMPONENT_LIBRARY) expect(subjectFor(c).noun).not.toMatch(/[/()]/);
  });

  it("reads naturally for components added later in Supabase", () => {
    const cases: [string, string, boolean][] = [
      ["Elevator (hydraulic)", "an elevator", false],
      ["Windows (wood)", "windows", true],
      ["Smoke detectors", "smoke detectors", true],
      ["Stairs", "stairs", true],
      ["Unit heater", "a unit heater", false],
      ["Utility sink", "a utility sink", false],
      ["Tile flooring", "tile flooring", false],
      ["HVAC rooftop unit", "an HVAC rooftop unit", false],
      ["LED lighting", "LED lighting", false],
      ["Gas", "a gas", false],
      ["Carpet & pad", "carpet and pad", false],
      ["Tile & grout", "tile and grout", false],
      ["Sink & faucet", "a sink and faucet", false],
      ["Doors & windows", "doors and windows", true],
      ["Stairs and railing", "stairs and railing", true],
      ["Hour meter", "an hour meter", false],
      ["X-ray room", "an X-ray room", false],
      ["U-bend", "a U-bend", false],
      ["A/C condenser", "an A/C condenser", false],
      ["(misc)", "a misc", false],
    ];
    for (const [name, noun, plural] of cases) expect(subjectFor(added(name))).toEqual({ noun, plural });
    expect(titleCase("a flat or membrane roof")).toBe("a Flat or Membrane Roof");
  });

  it("follows a rename made in the dashboard instead of the built-in wording", () => {
    const ac = bySlug("central-ac");
    expect(subjectFor(ac).noun).toBe("a central AC condenser");
    expect(subjectFor({ ...ac, name: "Mini-split heat pump" }).noun).toBe("a mini-split heat pump");
    expect(lifespanTitle({ ...ac, name: "Mini-split heat pump" })).toMatch(/^How Long Does a Mini-split Heat Pump Last\?/);
  });
});

describe("lifespan titles and descriptions", () => {
  it("fit in search results and keep the year range", () => {
    for (const c of COMPONENT_LIBRARY) {
      const title = lifespanTitle(c);
      expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
      expect(title).toContain(`${c.lifeLow}–${c.lifeHigh} Years`);
      const description = lifespanDescription(c, notesFor(c.slug) !== undefined);
      expect(description.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
    }
  });

  it("adds the brand only when it fits and falls back to a shorter form", () => {
    expect(lifespanTitle(bySlug("boiler"))).toBe("How Long Does a Boiler Last? (20–30 Years) | CapexClock");
    expect(lifespanTitle(bySlug("tank-water-heater"))).toBe("How Long Does a Tank Water Heater Last? (8–12 Years)");
    expect(lifespanTitle(bySlug("luxury-vinyl-plank"))).toBe("Luxury Vinyl Plank Flooring Lifespan: 15–25 Years");
    expect(lifespanTitle(added("Smoke detectors"))).toBe("How Long Do Smoke Detectors Last? (20–30 Years) | CapexClock");
    expect(lifespanTitle(added("Carpet & pad"))).toBe("How Long Does Carpet and Pad Last? (20–30 Years)");
    expect(lifespanTitle(added("(misc)"))).toBe("How Long Does a Misc Last? (20–30 Years) | CapexClock");
  });

  it("stay short for long names added later", () => {
    const long = { ...added("Underground stormwater detention system"), lifeLow: 30, lifeHigh: 50 };
    expect(lifespanTitle(long)).toBe("Underground Stormwater Detention System: 30–50 Years");
    const longer = { ...long, name: "Underground stormwater detention system and pump station with backup generator" };
    expect(lifespanTitle(longer)).toBe("Underground Stormwater Detention System…: 30–50 Years");
    const longest = { ...long, name: "Commercial kitchen hood, grease duct, exhaust fan, make-up air unit and fire suppression system", lifeLow: 100, lifeHigh: 100 };
    expect(lifespanTitle(longest)).toBe("Commercial Kitchen Hood, Grease Duct…: 100–100 Years");
    for (const item of [long, longer, longest]) {
      expect(lifespanTitle(item).length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
      expect(lifespanTitle(item)).toContain(`${item.lifeLow}–${item.lifeHigh} Years`);
      for (const hasNotes of [true, false]) {
        expect(lifespanDescription(item, hasNotes).length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
      }
    }
    expect(lifespanDescription(longer, false)).toBe(
      "An underground stormwater detention system and pump station with backup generator typically lasts 30 to 50 years. See what to set aside to replace it.",
    );
  });

  it("only promises the factors and signs when the page has them", () => {
    expect(lifespanDescription(bySlug("boiler"), true)).toBe(
      "A boiler typically lasts 20 to 30 years. See what shortens its life, the signs it's near the end, and what to set aside to replace it.",
    );
    const bare = lifespanDescription(added("Smoke detectors"), false);
    expect(bare).toBe(
      "Smoke detectors typically last 20 to 30 years. See when yours are likely due and what to set aside to replace them.",
    );
    expect(bare).not.toMatch(/shortens|signs/);
  });
});

describe("inSentence", () => {
  it("lower-cases words but keeps acronyms", () => {
    expect(inSentence("HVAC")).toBe("HVAC");
    expect(inSentence("Roofing")).toBe("roofing");
    expect(inSentence("Fire Safety")).toBe("fire safety");
  });

  it("reads as a modifier in the related-lifespans heading", () => {
    expect(categoryAsModifier("HVAC")).toBe("HVAC");
    expect(categoryAsModifier("Roofing")).toBe("roofing");
    expect(categoryAsModifier("Appliances")).toBe("appliance");
    expect(categoryAsModifier("Utilities")).toBe("utility");
    expect(categoryAsModifier("Finishes")).toBe("finish");
    expect(categoryAsModifier("Kitchen Fixtures")).toBe("kitchen fixture");
    expect(categoryAsModifier("Glass")).toBe("glass");
    expect(categoryAsModifier("Glasses")).toBe("glass");
    expect(categoryAsModifier("Doors & windows")).toBe("door and window");
    expect(categoryAsModifier("Kitchens & Baths")).toBe("kitchen and bath");
    expect(categoryAsModifier("Heating / Cooling")).toBe("heating and cooling");
    expect(categoryAsModifier("HVAC & Plumbing")).toBe("HVAC and plumbing");
    expect(categoryAsModifier("Grounds")).toBe("grounds");
  });
});

describe("lifeDrivers", () => {
  it("talks about use for equipment and wear for finishes", () => {
    expect(lifeDrivers(bySlug("gas-furnace"))).toBe("how it was installed, how heavily it's used and how well it's maintained");
    for (const slug of ["interior-paint", "carpet", "vinyl-siding", "kitchen-cabinets", "laminate-countertops", "parking-lot-seal-coat"]) {
      expect(lifeDrivers(bySlug(slug))).not.toMatch(/installed|works|used/);
    }
    expect(lifeDrivers(bySlug("kitchen-cabinets"))).toBe(
      "the quality of the materials and the work, how much wear they get and how well they're looked after",
    );
  });
});
