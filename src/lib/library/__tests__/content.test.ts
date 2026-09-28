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
      "central-ac",
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
    expect(notesFor("central-ac")?.safety).toMatch(/tripping/);
    expect(notesFor("boiler")?.safety).toMatch(/relief valve/);

    const hazards =
      /cracked heat exchanger|scorch|feel warm|burning|smoke|spark|soot|\btrip(s|ping)?\b|pressure|pilot|relief valve|trouble signal|drying time|carbon monoxide|\bCO\b|gas smell|smell gas/i;
    for (const [slug, notes] of Object.entries(LIFESPAN_NOTES)) {
      for (const sign of notes.signs) expect(`${slug}: ${sign}`).not.toMatch(hazards);
    }
  });

  it("gets people out and calls 911 before anything else when there may be carbon monoxide or gas", () => {
    for (const [slug, notes] of Object.entries(LIFESPAN_NOTES)) {
      const safety = notes.safety ?? "";
      if (!/CO alarm|carbon monoxide|smell gas/.test(safety)) continue;
      const leave = safety.search(/get everyone out(side)? and call 911/i);
      expect(`${slug}: ${leave}`).not.toBe(`${slug}: -1`);
      const pro = safety.search(/call a licensed|call your/i);
      if (pro >= 0) expect(leave).toBeLessThan(pro);
    }
  });

  it("only finds notes the file defines", () => {
    expect(notesFor("boiler")).toBe(LIFESPAN_NOTES.boiler);
    expect(notesFor("constructor")).toBeUndefined();
    expect(notesFor("elevator")).toBeUndefined();
  });
});
