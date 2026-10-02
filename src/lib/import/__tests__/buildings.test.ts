import { COMPONENT_LIBRARY } from "@/lib/library/components";
import {
  MAX_PROPERTIES,
  planProperties,
  planProperty,
  plannedProblems,
  plannedSave,
  planAnnouncement,
  portfolioSummary,
  propertyNameKey,
  sentTabs,
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

describe("a column with each building's unit count on its rows", () => {
  // Made-up buildings: Elm has 12 units and Oak 8, given on every row.
  const sheet = (heading: string) =>
    [
      `Building,${heading},Item,Year installed,Cost each`,
      "Elm,12,Asphalt shingle roof,2010,38000",
      "Elm,12,Tank water heater,2015,1400",
      "Oak,8,Asphalt shingle roof,2008,30000",
      "Oak,8,Tank water heater,2016,1400",
    ].join("\n");

  it("is asked about, and holds every building until it's answered", () => {
    for (const heading of ["# of units", "Unit count", "No. of units", "Total units", "Units"]) {
      const asked = preview(sheet(heading));
      expect(asked.quantityQuestion).toMatchObject({ column: 1, kind: "building", values: ["12", "8"], answer: null });
      expect(asked.counts).toMatchObject({ rows: 4, needsYou: 4 });
      const planned = planProperties(0, asked, names);
      expect(planned.map((p) => [p.name, p.waiting])).toEqual([
        ["Elm", [0, 1]],
        ["Oak", [0, 1]],
      ]);
      expect(plannedProblems(withEdits(planned[0], { unitCount: "12" }), CURRENT_YEAR)).toEqual([
        "Asphalt shingle roof and Tank water heater need you. Answer or fix them under Check the columns and rows first.",
      ]);
    }
  });

  it("answered as each building's unit count: one roof each, and a water heater in every unit", () => {
    for (const heading of ["# of units", "Units"]) {
      const answered = preview(sheet(heading), { columns: ["building", "unitCount", "item", "installYear", "cost"], quantityAnswered: true });
      expect(answered.quantityQuestion?.answer).toBe("each_one");
      const planned = planProperties(0, answered, names);
      expect(planned.map((p) => [p.name, p.unitCount, p.waiting, plannedProblems(p, CURRENT_YEAR)])).toEqual([
        ["Elm", "12", [], []],
        ["Oak", "8", [], []],
      ]);
      expect(planned.map((p) => plannedSave(p, CURRENT_YEAR).components.map((c) => [c.name, c.quantity, c.unit_label]))).toEqual([
        [
          ["Asphalt shingle roof", 1, "per_building"],
          ["Tank water heater", 12, "per_unit"],
        ],
        [
          ["Asphalt shingle roof", 1, "per_building"],
          ["Tank water heater", 8, "per_unit"],
        ],
      ]);
    }
  });

  it("answered as the quantity: kept as the sheet gives it", () => {
    const answered = preview(sheet("# of units"), { columns: ["building", "quantity", "item", "installYear", "cost"], quantityAnswered: true });
    expect(answered.quantityQuestion?.answer).toBe("quantity");
    const [elm] = planProperties(0, answered, names);
    expect(elm.waiting).toEqual([]);
    expect(elm.rows.map((r) => [r.name, r.quantity])).toEqual([
      ["Asphalt shingle roof", "12"],
      ["Tank water heater", "12"],
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
    expect(portfolioSummary(planned, 2)).toBe("2 properties to create from 5 rows. 1 row needs you.");
    expect(portfolioSummary(planned.slice(0, 1), 2)).toBe("1 property to create from 2 rows.");
    expect(portfolioSummary([], 0)).toBe("No properties to create yet. Tick a tab with rows.");
    // Every building is already in My properties, so none starts ticked.
    expect(portfolioSummary([], 23)).toBe("None of the 23 buildings are ticked to create. Tick the ones to make.");
    expect(portfolioSummary([], 1)).toBe("The property isn't ticked to create. Tick it to make it.");
  });
});

describe("after the first 20 of 23 buildings are created", () => {
  // Building 22 has a "Roof" row, which could be either kind of roof.
  const sheet = [
    "Building,Units,Item,Qty,Year installed,Life,Cost each",
    ...Array.from({ length: 23 }, (_, i) => `Bldg ${i + 1},4,${i === 21 ? "Roof" : "Boiler"},1,2010,25,9000`),
  ].join("\n");
  const planned = planProperties(0, preview(sheet), names);
  const results = Object.fromEntries(planned.slice(0, 20).map((p) => [p.id, { status: "created" }]));
  const rest = planned.slice(20);

  it("keeps which building each row is in, and leaves the rest of the review open", () => {
    expect(planned).toHaveLength(23);
    expect([...sentTabs(planned, results)]).toEqual([0]);
    expect(sentTabs(planned, {}).size).toBe(0);
    // A tab whose properties weren't sent stays free to change.
    expect([...sentTabs([...planned, { id: "1:", tab: 1 }], results)]).toEqual([0]);
  });

  it("says what's held back, by name, until it's answered there", () => {
    expect(rest.map((p) => [p.name, p.waiting])).toEqual([
      ["Bldg 21", []],
      ["Bldg 22", [0]],
      ["Bldg 23", []],
    ]);
    expect(plannedProblems(rest[1], CURRENT_YEAR)).toEqual([
      "Roof needs you. Answer or fix it under Check the columns and rows first.",
    ]);
    const answer = preview(sheet).questions[0];
    const answered = planProperties(0, preview(sheet, { answers: { [answer.key]: "asphalt-shingle-roof" } }), names);
    // The answer changes only the rows of the building that waited.
    expect(answered.slice(0, 20).map((p) => p.rows)).toEqual(planned.slice(0, 20).map((p) => p.rows));
    expect(answered[21].waiting).toEqual([]);
    expect(answered[21].rows[0].name).toBe("Asphalt shingle roof");
    expect(plannedProblems(answered[21], CURRENT_YEAR)).toEqual([]);
  });

  it("announces the buildings ticked next, and nothing while there are none", () => {
    const state = { read: true, running: false, started: true };
    expect(planAnnouncement(state, [], 23)).toBe("");
    expect(planAnnouncement(state, rest, 23)).toBe("3 properties to create from 3 rows. 1 row needs you.");
    expect(planAnnouncement({ ...state, running: true }, rest, 23)).toBe("");
    // Before any are created, the plan is read out as before.
    expect(planAnnouncement({ ...state, started: false }, planned.slice(0, 20), 23)).toBe("20 properties to create from 20 rows.");
    expect(planAnnouncement({ ...state, started: false }, [], 23)).toBe(
      "None of the 23 buildings are ticked to create. Tick the ones to make.",
    );
    expect(planAnnouncement({ read: false, running: false, started: false }, [], 0)).toBe("");
  });
});
