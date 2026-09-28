import { COMPONENT_LIBRARY } from "../components";
import { LIFESPAN_NOTES, notesFor } from "../content";

describe("lifespan notes", () => {
  it("belong to components in the library", () => {
    const slugs = new Set(COMPONENT_LIBRARY.map((c) => c.slug));
    for (const slug of Object.keys(LIFESPAN_NOTES)) expect(slugs.has(slug)).toBe(true);
  });

  it("put hazards in a safety note that says to act now, not in the budgeting signs", () => {
    for (const slug of [
      "gas-furnace",
      "boiler",
      "tank-water-heater",
      "tankless-water-heater",
      "range-oven",
      "washer-dryer",
      "electrical-panel",
      "fire-alarm-panel",
    ]) {
      expect(notesFor(slug)?.safety).toMatch(/now|outside/);
    }
    expect(notesFor("gas-furnace")?.safety).toMatch(/carbon monoxide/);
    expect(notesFor("electrical-panel")?.safety).toMatch(/electrician/);

    const hazards = /heat exchanger|scorch|feel warm|trouble signal|drying time|carbon monoxide|gas smell/i;
    const furnaceAndPanels = ["gas-furnace", "electrical-panel", "fire-alarm-panel", "washer-dryer"];
    for (const slug of furnaceAndPanels) {
      for (const sign of notesFor(slug)?.signs ?? []) expect(sign).not.toMatch(hazards);
    }
  });

  it("only finds notes the file defines", () => {
    expect(notesFor("boiler")).toBe(LIFESPAN_NOTES.boiler);
    expect(notesFor("constructor")).toBeUndefined();
    expect(notesFor("elevator")).toBeUndefined();
  });
});
