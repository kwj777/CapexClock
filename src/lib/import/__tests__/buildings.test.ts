import { COMPONENT_LIBRARY } from "@/lib/library/components";
import {
  MAX_PROPERTIES,
  planProperties,
  planProperty,
  plannedProblems,
  portfolioSummary,
  propertyNameKey,
  startingPicks,
  withEdits,
} from "../buildings";
import { CURRENT_YEAR, match, open, preview } from "../__fixtures__/sheets";
import { startingChoices } from "../open";
import { buildPreview } from "../preview";

const names = { tab: null, file: "buildings.csv" };

/** Made-up buildings in one sheet, each named on every row. */
const BUILDINGS = [
  "Building,Units,Year built,Item,Qty,Year installed,Life,Cost each",
  "12 Elm St,4,1962,Water heater,4,2015,10,1300",
  "12 Elm St,4,1962,Gas furnace,4,2011,18,4000",
  "40 Birch Ave,6,1985,Asphalt shingle roof,1,2009,22,30000",
  "40 Birch Ave,6,1985,Refrigerator,6,Jun-14,13,900",
  "40 Birch Ave,6,1985,Zorbex,1,2019,10,700",
].join("\n");

describe("planning a property for each building", () => {
  it("splits one preview of every row by building, the same as reading each building alone", () => {
    const opened = open(BUILDINGS);
    const all = preview(BUILDINGS);
    const planned = planProperties(0, all, names);
    expect(planned.map((p) => [p.id, p.name, p.unitCount, p.yearBuilt, p.rows.length])).toEqual([
      ["0:12 elm st", "12 Elm St", "4", "1962", 2],
      ["0:40 birch ave", "40 Birch Ave", "6", "1985", 3],
    ]);
    for (const b of all.buildings) {
      const choices = { ...startingChoices(opened, CURRENT_YEAR), building: b.key };
      const one = buildPreview(opened.sheet, choices, COMPONENT_LIBRARY, match, CURRENT_YEAR);
      const property = planned.find((p) => p.building === b.key);
      expect(property?.rows).toEqual(one.rows.map((r) => r.row));
    }
  });

  it("notes the rows that need the owner: an unread year and an item it asks about", () => {
    const [elm, birch] = planProperties(0, preview(BUILDINGS), names);
    expect(elm.waiting).toEqual([]);
    // Jun-14 can't be read, and "Zorbex" isn't a name we know but isn't asked about.
    expect(birch.rows.map((r) => r.name)).toEqual(["Asphalt shingle roof", "Refrigerator", "Zorbex"]);
    expect(birch.waiting).toEqual([1]);
  });

  it("plans one property for a sheet that names no buildings", () => {
    const sheet = ["Item,Qty,Year installed,Life,Cost each", "Water heater,4,2015,10,1300"].join("\n");
    const planned = planProperties(2, preview(sheet), { tab: "Maple Court", file: null });
    expect(planned.map((p) => [p.id, p.name, p.rows.length])).toEqual([["2:", "Maple Court", 1]]);
  });
});

describe("a property whose rows need the owner", () => {
  // A "Units" column with 12 on every row: the quantity, or the building's unit count?
  const sheet = ["Item,Units,Year installed,Life,Cost", "Water heater,12,2015,10,1400", "Furnace,12,2010,18,4200"].join("\n");

  it("can't be created until the question is answered, and says so by name", () => {
    const asked = preview(sheet);
    expect(asked.quantityQuestion?.answer).toBeNull();
    const [property] = planProperties(0, asked, names);
    expect(property.waiting).toEqual([0, 1]);
    expect(plannedProblems(withEdits(property, { unitCount: "12" }), CURRENT_YEAR)).toEqual([
      "Tank water heater and Gas furnace need you. Answer or fix them under Check the columns and rows first.",
    ]);
    // Answered: the building's unit count, so each row counts as one.
    const answered = preview(sheet, { columns: ["item", "unitCount", "installYear", "life", "cost"], quantityAnswered: true });
    const [ready] = planProperties(0, answered, names);
    expect(ready.waiting).toEqual([]);
    expect(ready.unitCount).toBe("12");
    expect(plannedProblems(ready, CURRENT_YEAR)).toEqual([]);
  });

  it("names a row once, under what it needs, not again as a row that can't be saved", () => {
    const [, birch] = planProperties(0, preview(BUILDINGS), names);
    expect(plannedProblems(birch, CURRENT_YEAR)).toEqual([
      "Refrigerator needs you. Answer or fix it under Check the columns and rows first.",
    ]);
  });

  it("shortens a long list of names", () => {
    const base = planProperty(0, { key: "", name: "A", unitCount: 4, yearBuilt: 1990, records: 6, notes: [] }, [], names);
    const row = preview(["Item,Qty,Year installed,Life,Cost", "Boiler,1,2010,30,9000"].join("\n")).rows[0].row;
    const rows = ["Boiler", "Roof", "Carpet", "Range", "Fridge", "Stove"].map((name) => ({ ...row, name }));
    expect(plannedProblems({ ...base, rows, waiting: [0, 1, 2, 3, 4, 5] }, CURRENT_YEAR)).toEqual([
      "Boiler, Roof, Carpet and 3 more need you. Answer or fix them under Check the columns and rows first.",
    ]);
  });
});

describe("which properties start ticked", () => {
  const properties = Array.from({ length: 23 }, (_, i) => ({ id: `0:b${i + 1}`, name: `Building ${i + 1}` }));

  it("ticks the first 20", () => {
    const picks = startingPicks(properties, new Set());
    expect(picks.size).toBe(MAX_PROPERTIES);
    expect(picks.has("0:b20")).toBe(true);
    expect(picks.has("0:b21")).toBe(false);
  });

  it("leaves out buildings already in My properties, so importing again for the rest makes no copies", () => {
    const existing = new Set(properties.slice(0, 20).map((p) => propertyNameKey(p.name)));
    expect([...startingPicks(properties, existing)]).toEqual(["0:b21", "0:b22", "0:b23"]);
  });

  it("matches names whatever their case, spacing and punctuation", () => {
    expect(propertyNameKey("12 Elm St.")).toBe(propertyNameKey("  12 elm st "));
    expect(propertyNameKey("12 Elm St")).not.toBe(propertyNameKey("14 Elm St"));
  });
});

describe("what the live region says about the plan", () => {
  it("counts properties, rows and rows that need the owner", () => {
    const planned = planProperties(0, preview(BUILDINGS), names);
    expect(portfolioSummary(planned)).toBe("2 properties to create from 5 rows. 1 row needs you.");
    expect(portfolioSummary(planned.slice(0, 1))).toBe("1 property to create from 2 rows.");
    expect(portfolioSummary([])).toBe("No properties to create yet. Tick a tab with rows.");
  });
});
