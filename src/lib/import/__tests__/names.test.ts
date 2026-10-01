import { COMPONENT_LIBRARY, type LibraryComponent } from "@/lib/library/components";
import { ALIASES, createMatcher, editDistance, nameKey, UNSURE_NAMES } from "../names";

const match = createMatcher(COMPONENT_LIBRARY);
const slugs = new Set(COMPONENT_LIBRARY.map((c) => c.slug));

describe("matching names to the library", () => {
  it("knows the library's own names, in any case", () => {
    expect(match("Refrigerator")).toEqual({ kind: "exact", slug: "refrigerator" });
    expect(match("tank water heater")).toEqual({ kind: "exact", slug: "tank-water-heater" });
    expect(match("  Gas furnace ")).toEqual({ kind: "exact", slug: "gas-furnace" });
  });

  it.each([
    ["HWH", "tank-water-heater"],
    ["hot water tank", "tank-water-heater"],
    ["Hot water heater", "tank-water-heater"],
    ["Water heater", "tank-water-heater"],
    ["fridge", "refrigerator"],
    ["Fridges", "refrigerator"],
    ["Refrigerators", "refrigerator"],
    ["A/C", "central-ac"],
    ["AC units", "central-ac"],
    ["W/D", "washer-dryer"],
    ["Stove", "range-oven"],
    ["LVP", "luxury-vinyl-plank"],
    ["Furnace", "gas-furnace"],
    ["Tankless", "tankless-water-heater"],
    ["Seal coating", "parking-lot-seal-coat"],
    ["Gutters", "gutters"],
    ["Siding", "vinyl-siding"],
  ])("matches %p to %p", (name, slug) => {
    expect(match(name)).toEqual({ kind: "matched", slug, extraWords: false });
  });

  it("matches close spellings", () => {
    expect(match("Refridgerator")).toEqual({ kind: "matched", slug: "refrigerator", extraWords: false });
    expect(match("Dishwaser")).toEqual({ kind: "matched", slug: "dishwasher", extraWords: false });
    expect(match("Furnance")).toEqual({ kind: "matched", slug: "gas-furnace", extraWords: false });
  });

  it("matches names with a brand, a size or an apartment number, and says there were extra words", () => {
    expect(match("Rheem water heater 40 gal")).toEqual({ kind: "matched", slug: "tank-water-heater", extraWords: true });
    expect(match("Water heater - unit 3")).toEqual({ kind: "matched", slug: "tank-water-heater", extraWords: true });
    expect(match("GE fridge")).toEqual({ kind: "matched", slug: "refrigerator", extraWords: true });
  });

  it("picks the longest name, so tankless isn't read as a tank water heater", () => {
    expect(match("Tankless water heater").kind).toBe("exact");
    expect(match("Navien tankless water heater")).toEqual({ kind: "matched", slug: "tankless-water-heater", extraWords: true });
  });

  it("asks instead of guessing when a name could be more than one item", () => {
    expect(match("Roof")).toEqual({ kind: "unsure", suggestions: ["asphalt-shingle-roof", "flat-membrane-roof"], extraWords: false });
    expect(match("HVAC")).toEqual({ kind: "unsure", suggestions: ["gas-furnace", "central-ac", "heat-pump"], extraWords: false });
    expect(match("Paint")).toMatchObject({ kind: "unsure", suggestions: ["interior-paint", "exterior-paint"] });
  });

  it("asks when a name has more than the item in it", () => {
    expect(match("Roof over garage")).toEqual({
      kind: "unsure",
      suggestions: ["asphalt-shingle-roof", "flat-membrane-roof"],
      extraWords: true,
    });
    expect(match("Furnace filter")).toEqual({ kind: "unsure", suggestions: ["gas-furnace"], extraWords: true });
    const both = match("Kitchen cabinets and counters");
    expect(both.kind).toBe("unsure");
    expect(both.kind === "unsure" && both.suggestions).toEqual(expect.arrayContaining(["kitchen-cabinets", "laminate-countertops"]));
  });

  it("keeps everything else as the owner's own item", () => {
    expect(match("Elevator")).toEqual({ kind: "none" });
    expect(match("Mailboxes")).toEqual({ kind: "none" });
    expect(match("Toilets")).toEqual({ kind: "none" });
    expect(match("")).toEqual({ kind: "none" });
    expect(match("40 gal")).toEqual({ kind: "none" });
  });

  it("follows the library as edited in Supabase", () => {
    const edited: LibraryComponent[] = [
      ...COMPONENT_LIBRARY.filter((c) => c.slug !== "refrigerator"),
      { slug: "elevator", category: "Mechanical", name: "Elevator", lifeLow: 20, lifeHigh: 30, unitLabel: "per_building" },
    ];
    const editedMatch = createMatcher(edited);
    expect(editedMatch("fridge")).toEqual({ kind: "none" });
    expect(editedMatch("Elevator")).toEqual({ kind: "exact", slug: "elevator" });
    expect(editedMatch("Elevators")).toEqual({ kind: "matched", slug: "elevator", extraWords: false });
  });

  it("only names library items in its aliases", () => {
    for (const slug of Object.keys(ALIASES)) expect(slugs).toContain(slug);
    for (const options of Object.values(UNSURE_NAMES)) for (const slug of options) expect(slugs).toContain(slug);
  });
});

describe("name helpers", () => {
  it("compares names by their words, without sizes or plurals", () => {
    expect(nameKey("Water Heaters (40gal)")).toBe("water heater");
    expect(nameKey("A/C unit #3")).toBe("a c unit");
    expect(nameKey("Gas")).toBe("gas");
  });

  it("counts a swap of neighbours as one edit", () => {
    expect(editDistance("furnace", "furnace")).toBe(0);
    expect(editDistance("furnance", "furnace")).toBe(1);
    expect(editDistance("fridge", "firdge")).toBe(1);
    expect(editDistance("roof", "")).toBe(4);
  });
});
