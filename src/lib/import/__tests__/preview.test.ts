import { MAX_NOTES_LENGTH } from "@/components/calculator/draft";
import { isTotalLabel, KEEP_OWN, locationLine, mergedNotes, type Preview, type PreviewRow } from "../preview";
import {
  AGE_ROWS,
  APARTMENT_ROWS,
  ITEM_ROWS,
  NUMBERED_ROWS,
  open,
  preview,
  REMAINING_ROWS,
  REPLACE_BY_ROWS,
  STUDY_ROWS,
} from "../__fixtures__/sheets";

function byName(p: Preview, name: string): PreviewRow {
  const row = p.rows.find((r) => r.row.name === name);
  if (!row) throw new Error(`No row named ${name}: ${p.rows.map((r) => r.row.name).join(", ")}`);
  return row;
}

describe("a sheet with one row per item, a title block and a totals row", () => {
  const p = preview(ITEM_ROWS, {}, "paste");

  it("finds the headings under the title and guesses every column", () => {
    const opened = open(ITEM_ROWS, "paste");
    expect(opened.sheet.headerRow).toBe(3);
    expect(opened.layout).toBe("rows");
    expect(opened.offersColumnLayout).toBe(false);
    expect(opened.columns).toEqual(["item", "quantity", "installYear", "life", "cost", "total", "condition", "notes"]);
  });

  it("lists the title rows, the blank row and the totals row as skipped", () => {
    expect(p.skipped).toEqual([
      { sheetRow: 1, reason: "above_headings" },
      { sheetRow: 2, reason: "above_headings" },
      { sheetRow: 10, reason: "blank" },
      { sheetRow: 13, reason: "total" },
    ]);
    expect(p.counts).toEqual({ rows: 7, ready: 1, changed: 4, needsYou: 2, skipped: 4 });
  });

  it("asks which roof it is instead of guessing, and keeps it as its own item until answered", () => {
    expect(p.questions).toEqual([
      { key: "roof", text: "Roof", rows: 1, suggestions: ["asphalt-shingle-roof", "flat-membrane-roof"] },
    ]);
    const roof = byName(p, "Roof");
    expect(roof.status).toBe("needs_you");
    expect(roof.question).toBe("roof");
    expect(roof.row).toMatchObject({ librarySlug: null, category: "Other", installYear: "2008", installYearIsGuess: true });
    expect(roof.changes).toEqual(['Read "approx 2008" as 2008, marked a guess']);
    expect(roof.row.notes).toBe("Patched 2019");
    expect(roof.row.condition).toBe("fair");
  });

  it("applies the answer: category, unit and the sheet's own life", () => {
    const answered = preview(ITEM_ROWS, { answers: { roof: "asphalt-shingle-roof" } }, "paste");
    const roof = byName(answered, "Asphalt shingle roof");
    expect(roof.status).toBe("changed");
    expect(roof.row).toMatchObject({ librarySlug: "asphalt-shingle-roof", category: "Roofing", usefulLife: "22", unitLabel: "per_building" });
    expect(roof.changes).toContain('Matched "Roof" to Asphalt shingle roof');
    // Still listed, so the answer can be changed.
    expect(answered.questions).toHaveLength(1);

    const own = byName(preview(ITEM_ROWS, { answers: { roof: KEEP_OWN } }, "paste"), "Roof");
    expect(own.status).toBe("changed");
    expect(own.row.librarySlug).toBeNull();
  });

  it("matches aliases and fills in the library's category, unit and typical life", () => {
    const fridge = byName(p, "Refrigerator");
    expect(fridge.row).toMatchObject({
      librarySlug: "refrigerator",
      category: "Appliances",
      unitLabel: "per_unit",
      quantity: "12",
      installYear: "",
      usefulLife: "13",
      costEach: "1400",
      condition: "fair",
      notes: "",
    });
    expect(fridge.lifeIsTypical).toBe(true);
    expect(fridge.changes).toEqual([
      'Matched "Fridge" to Refrigerator',
      'Read "orig" as no install year, so it uses the year built, marked an estimate',
      'Read "1.4k" as $1,400',
      'Read "ok" as Fair',
    ]);
  });

  it("uses the cost each over the total, and ignores the quantity's unit words", () => {
    const heater = byName(p, "Tank water heater");
    expect(heater.row).toMatchObject({ quantity: "12", costEach: "1400", installYear: "2016", usefulLife: "10", condition: "good" });
    expect(heater.changes).toEqual(['Matched "Water heater" to Tank water heater']);
  });

  it("marks Jun-14 Needs you and keeps it as typed, so the calculator flags it too", () => {
    const furnace = byName(p, "Gas furnace");
    expect(furnace.status).toBe("needs_you");
    expect(furnace.issues).toEqual([
      { field: "installYear", text: `Couldn't tell which year "Jun-14" means. Type the 4-digit year.` },
    ]);
    expect(furnace.row.installYear).toBe("Jun-14");
  });

  it("takes a fix typed in the preview", () => {
    const fixedPreview = preview(ITEM_ROWS, { fixes: { r7: { installYear: "2014" } } }, "paste");
    const furnace = byName(fixedPreview, "Gas furnace");
    expect(furnace.status).toBe("changed");
    expect(furnace.row.installYear).toBe("2014");
    expect(furnace.issues).toEqual([]);
  });

  it("reads square feet, plain library names as Ready, and unknown costs as blank", () => {
    const carpet = byName(p, "Carpet");
    expect(carpet.status).toBe("ready");
    expect(carpet.row).toMatchObject({ quantity: "9600", unitLabel: "per_sq_ft", costEach: "4" });
    const elevator = byName(p, "Elevator");
    expect(elevator.row).toMatchObject({ librarySlug: null, category: "Other", costEach: "", usefulLife: "25", unitLabel: "per_building" });
    expect(elevator.changes).toEqual(['Left the cost blank ("call")']);
    expect(p.withoutCost).toBe(1);
  });

  it("fixes typos and uses the higher figure of a cost range", () => {
    const dishwasher = byName(p, "Dishwasher");
    expect(dishwasher.row.costEach).toBe("800");
    expect(dishwasher.changes).toEqual([
      'Matched "Dishwaser" to Dishwasher',
      'Used the higher figure of "$650-$800": $800',
    ]);
  });

  it("can be told a column means something else, or to ignore it", () => {
    const columns = open(ITEM_ROWS, "paste").columns.map((c) => (c === "notes" || c === "condition" ? "ignore" : c));
    const ignored = preview(ITEM_ROWS, { columns }, "paste");
    expect(byName(ignored, "Roof").row).toMatchObject({ notes: "", condition: null });
  });
});

describe("a sheet with one row per apartment and a column per item", () => {
  const p = preview(APARTMENT_ROWS);

  it("turns each apartment's row into one row per item and merges identical ones", () => {
    const heaters = p.rows.filter((r) => r.row.librarySlug === "tank-water-heater");
    expect(heaters.map((r) => [r.row.installYear, r.row.quantity, r.row.notes])).toEqual([
      ["2014", "3", "Apt: 101, 102 and 104"],
      ["2016", "1", "Apt: 103"],
    ]);
    expect(heaters[0].sheetRows).toEqual([2, 3, 5]);
    expect(heaters[0].changes).toEqual(["Combined 3 identical rows"]);
    expect(heaters[1].status).toBe("ready");
  });

  it("keeps approximate and exact years apart, since the guess differs", () => {
    const fridges = p.rows.filter((r) => r.row.librarySlug === "refrigerator");
    expect(fridges.map((r) => [r.row.installYear, r.row.installYearIsGuess, r.row.quantity])).toEqual([
      ["2018", true, "3"],
      ["2018", false, "1"],
    ]);
  });

  it("reads N as not there, Y as there with no year, and a blank as not listed", () => {
    const dishwashers = p.rows.filter((r) => r.row.librarySlug === "dishwasher");
    expect(dishwashers.map((r) => [r.row.notes, r.row.installYear])).toEqual([
      ["Apt: 102", ""],
      ["Apt: 103", "2020"],
    ]);
    expect(p.skipped).toEqual([{ sheetRow: 6, reason: "nothing_listed" }]);
  });

  it("never reads the tenant column", () => {
    const everything = JSON.stringify(p);
    expect(everything).not.toContain("Smith");
    expect(everything).not.toContain("Jones");
  });

  it("can be read one row per item instead, which then needs an item column", () => {
    const opened = open(APARTMENT_ROWS);
    expect(opened.offersColumnLayout).toBe(true);
    const asRows = preview(APARTMENT_ROWS, { layout: "rows", columns: ["location", "ignore", "ignore", "ignore", "ignore", "ignore"] });
    expect(asRows.missingItemColumn).toBe(true);
    expect(asRows.rows).toEqual([]);
  });
});

describe("a sheet with ages", () => {
  it("counts back from the year the sheet was last updated, marking guesses", () => {
    const p = preview(AGE_ROWS, { sheetYear: 2024 });
    expect(p.usesSheetYear).toBe(true);
    const heater = byName(p, "Tank water heater");
    expect(heater.row).toMatchObject({ installYear: "2016", installYearIsGuess: true, quantity: "24", costEach: "1400" });
    expect(heater.changes).toContain("Counted 8 years back from 2024: installed about 2016, marked a guess");
    expect(byName(p, "Central AC / condenser").row).toMatchObject({ installYear: "2019", costEach: "3500" });
    expect(byName(p, "Boiler").row.installYear).toBe("2024");
  });

  it("waits for a valid sheet year", () => {
    const p = preview(AGE_ROWS, { sheetYear: null });
    expect(byName(p, "Boiler").issues).toEqual([
      { field: "installYear", text: "Fix the year this sheet was last updated, above." },
    ]);
  });
});

describe("a sheet with expected and remaining life", () => {
  const p = preview(REMAINING_ROWS);

  it("works out install years from the life, the sheet's or the library's", () => {
    expect(byName(p, "Asphalt shingle roof").row).toMatchObject({ installYear: "2006", usefulLife: "25", installYearIsGuess: true });
    expect(byName(p, "Gutters and downspouts").row).toMatchObject({ installYear: "2011", usefulLife: "25" });
    expect(byName(p, "Parking lot seal coat").row).toMatchObject({ installYear: "2022", quantity: "12000", costEach: "0.25", unitLabel: "per_sq_ft" });
  });

  it("asks when the years left don't fit the life, and when there's no life to count from", () => {
    const siding = byName(p, "Vinyl siding");
    expect(siding.status).toBe("needs_you");
    expect(siding.row.installYear).toBe("50 left");
    const elevator = byName(p, "Elevator");
    expect(elevator.issues).toEqual([
      { field: "usefulLife", text: 'Add a useful life, so the install year can be worked out from the years left ("8").' },
    ]);
    const fixed = byName(preview(REMAINING_ROWS, { fixes: { r5: { usefulLife: "25" } } }), "Elevator");
    expect(fixed.row).toMatchObject({ installYear: "2009", usefulLife: "25", installYearIsGuess: true });
    expect(fixed.status).toBe("changed");
  });
});

describe("a sheet with replace-by years", () => {
  it("takes the life off the replace-by year", () => {
    const p = preview(REPLACE_BY_ROWS);
    expect(byName(p, "Dishwasher").row.installYear).toBe("2019");
    expect(byName(p, "Range / oven").row.installYear).toBe("2012");
    expect(byName(p, "Windows (vinyl)").row.installYear).toBe("2003");
    expect(byName(p, "Gas furnace").row.installYear).toBe("2022");
    expect(p.counts).toMatchObject({ rows: 4, changed: 4, needsYou: 0 });
  });
});

describe("mixed date formats", () => {
  const sheet = [
    "Item,Unit,Installed,Cost",
    "Fridge,1A,6/12/2014,$1100",
    "Fridge,1B,2014-06-12,$1100",
    "Fridge,2A,June 2014,$1100",
    "Fridge,2B,c. 2010,$1100",
    "Fridge,3A,'14,$1100",
    "Fridge,3B,2012-2014,$1100",
  ].join("\n");
  const p = preview(sheet);

  it("merges the dates that are the same year, and leaves the doubtful ones for the owner", () => {
    expect(p.rows.map((r) => [r.status, r.row.installYear, r.row.quantity, r.row.notes])).toEqual([
      ["changed", "2014", "3", "Unit: 1A, 1B and 2A"],
      ["changed", "2010", "1", "Unit: 2B"],
      ["needs_you", "'14", "1", "Unit: 3A"],
      ["needs_you", "2012-2014", "1", "Unit: 3B"],
    ]);
    expect(p.noQuantityColumn).toBe(true);
  });
});

describe("totals, repeated headings and section headings", () => {
  const sheet = [
    "Item,Qty,Total,Category",
    "HVAC,,,",
    "Water heater,12,\"$16,800\",",
    "Mini fridge,1,$300,",
    "Item,Qty,Total,Category",
    "Interior:,,,",
    "Ceiling fan,10,$1500,",
    "Mailboxes,1,$2000,Exterior",
    "Dishwasher,0,,",
    ",12,$500,",
    ",,,see notes",
    "Grand total,,\"$20,600\",",
  ].join("\n");
  const p = preview(sheet);

  it("divides a total by the quantity, and uses a total of one as the cost", () => {
    expect(byName(p, "Tank water heater").row.costEach).toBe("1400");
    expect(byName(p, "Tank water heater").changes).toContain("Divided the $16,800 total by 12: $1,400 each");
    expect(byName(p, "Mini fridge").changes).toContain("Used the total, $300, as the cost");
  });

  it("skips and lists repeated headings, section headings, zero quantities, empty rows and totals", () => {
    expect(p.skipped).toEqual([
      { sheetRow: 2, reason: "section" },
      { sheetRow: 5, reason: "repeated_headings" },
      { sheetRow: 6, reason: "section" },
      { sheetRow: 9, reason: "zero_quantity" },
      { sheetRow: 11, reason: "no_name" },
      { sheetRow: 12, reason: "total" },
    ]);
  });

  it("files own items under the section or the category column", () => {
    expect(byName(p, "Mini fridge").row.category).toBe("HVAC");
    expect(byName(p, "Ceiling fan").row.category).toBe("Interior");
    expect(byName(p, "Mailboxes").row.category).toBe("Exterior");
  });

  it("asks for a name when a row has numbers but no item", () => {
    const unnamed = p.rows.find((r) => r.row.name === "");
    expect(unnamed?.status).toBe("needs_you");
    expect(unnamed?.issues).toEqual([{ field: "name", text: "This row has no item name. Type one." }]);
    const named = preview(sheet, { fixes: { r9: { name: "Range" } } });
    expect(named.rows.some((r) => r.row.librarySlug === "range-oven" && r.sheetRows[0] === 10)).toBe(true);
  });
});

describe("a sheet with numbered rows", () => {
  const p = preview(NUMBERED_ROWS, {}, "paste");

  it("reads the Qty column for quantities, not the row numbers", () => {
    expect(open(NUMBERED_ROWS, "paste").columns).toEqual(["ignore", "item", "quantity", "installYear", "cost"]);
    expect(p.rows.map((r) => [r.row.name, r.row.quantity])).toEqual([
      ["Tank water heater", "12"],
      ["Gas furnace", "12"],
      ["Boiler", "1"],
    ]);
    expect(p.doubtfulQuantity).toBeNull();
  });

  it("skips the total at the foot, even with a number in front of it", () => {
    expect(p.skipped).toEqual([{ sheetRow: 5, reason: "total" }]);
  });

  it("uses # as the quantity when nothing else is, and says so", () => {
    const sheet = ["#,Item,Year", "12,Fridge,2018", "1,Roof,2008", "24,Smoke detector,2020"].join("\n");
    const counts = preview(sheet);
    expect(counts.rows.map((r) => r.row.quantity)).toEqual(["12", "1", "24"]);
    expect(counts.doubtfulQuantity).toEqual({ column: 0, heading: "#" });
    const numbered = preview(["#,Item,Year", "1,Fridge,2018", "2,Roof,2008", "3,Smoke detector,2020"].join("\n"));
    expect(numbered.rows.map((r) => r.row.quantity)).toEqual(["1", "1", "1"]);
    expect(numbered.noQuantityColumn).toBe(true);
    expect(numbered.doubtfulQuantity).toBeNull();
  });
});

describe("a reserve study with subtotals, decades and limits", () => {
  const p = preview(STUDY_ROWS);

  it("skips every subtotal and total, labelled or not", () => {
    expect(p.skipped).toEqual([
      { sheetRow: 1, reason: "above_headings" },
      { sheetRow: 5, reason: "total" },
      { sheetRow: 8, reason: "total" },
      { sheetRow: 9, reason: "total" },
      { sheetRow: 10, reason: "total" },
    ]);
    expect(p.rows).toHaveLength(4);
  });

  it("reads decades as guesses and asks about years before a limit", () => {
    expect(byName(p, "Gutters and downspouts").row).toMatchObject({ installYear: "1990", installYearIsGuess: true });
    expect(byName(p, "Gutters and downspouts").changes).toContain('Read "1990s" as 1990, marked a guess');
    expect(byName(p, "Interior paint (turnover)").row).toMatchObject({ installYear: "2000", installYearIsGuess: true, quantity: "8" });
    const carpet = byName(p, "Carpet");
    expect(carpet.status).toBe("needs_you");
    expect(carpet.row.installYear).toBe("pre-2000");
    expect(carpet.issues).toEqual([
      { field: "installYear", text: '"pre-2000" doesn\'t give one year. Type your best guess, with "approx" in front to mark it a guess.' },
    ]);
    const fixed = byName(preview(STUDY_ROWS, { fixes: { r5: { installYear: "approx 1996" } } }), "Carpet");
    expect(fixed.row).toMatchObject({ installYear: "1996", installYearIsGuess: true });
    expect(fixed.status).toBe("changed");
  });
});

describe("total rows", () => {
  it.each([
    "Total",
    "TOTALS",
    "Total:",
    "Grand total",
    "Subtotal",
    "Sub-total",
    "Subtotal - interiors",
    "Total CapEx",
    "Total replacement cost",
    "Totals for building",
    "Total reserve needed",
    "Total (all items)",
    "Annual total",
    "Roofing subtotal",
    "Sum",
    "Sum:",
    "Sum of costs",
  ])("knows %p is a total", (label) => {
    expect(isTotalLabel(label)).toBe(true);
  });

  it.each(["Water heater", "Totaled washer", "Sump pump", "Summit boiler", "Sum pump", "Subfloor"])("knows %p isn't", (label) => {
    expect(isTotalLabel(label)).toBe(false);
  });

  it("skips amounts with no name and nothing else, but asks about a row with other numbers", () => {
    const sheet = ["Item,Qty,Cost,Total", "Fridge,12,$1100,\"$13,200\"", ",,,\"$48,000\"", ",,$1100,", ",12,,$500"].join("\n");
    const p = preview(sheet);
    expect(p.skipped).toEqual([
      { sheetRow: 3, reason: "total" },
      { sheetRow: 4, reason: "total" },
    ]);
    expect(p.rows.map((r) => [r.row.name, r.status])).toEqual([
      ["Refrigerator", "changed"],
      ["", "needs_you"],
    ]);
  });

  it("skips totals in a sheet with a column per item", () => {
    const sheet = ["Apt,Water heater installed,Furnace installed", "101,2014,2012", "Total units,1,1"].join("\n");
    expect(preview(sheet).skipped).toEqual([{ sheetRow: 3, reason: "total" }]);
  });
});

describe("a total that disagrees with the quantity and cost each", () => {
  it("works out the quantity from the total when the sheet has no quantity", () => {
    const p = preview(["Item,Units,Unit cost,Total", "Water heater,12,1400,16800"].join("\n"));
    const heater = byName(p, "Tank water heater");
    expect(heater.row).toMatchObject({ quantity: "12", costEach: "1400" });
    expect(heater.changes).toContain("Worked out the quantity, 12, from the $16,800 total at $1,400 each");
    expect(heater.status).toBe("changed");
  });

  it("asks when the sheet's quantity doesn't fit, and takes a fix", () => {
    const sheet = ["Item,Qty,Cost each,Total", "Water heater,1,1400,16800", "Fridge,3,333.33,1000"].join("\n");
    const p = preview(sheet);
    const heater = byName(p, "Tank water heater");
    expect(heater.status).toBe("needs_you");
    expect(heater.issues).toEqual([
      { field: "quantity", text: "The sheet's total, $16,800, isn't 1 × $1,400. Fix the quantity or the cost each, or ignore the Total column." },
      { field: "costEach", text: "Leave this blank to keep $1,400." },
    ]);
    // Rounding is fine.
    expect(byName(p, "Refrigerator").issues).toEqual([]);
    const fixed = byName(preview(sheet, { fixes: { r1: { quantity: "12" } } }), "Tank water heater");
    expect(fixed.issues).toEqual([]);
    expect(fixed.row.quantity).toBe("12");
  });

  it("asks when the total isn't a whole number of the cost each", () => {
    const p = preview(["Item,Cost,Total", "Fridge,1100,2000"].join("\n"));
    expect(byName(p, "Refrigerator").issues[0]).toEqual({
      field: "quantity",
      text: "The sheet's total, $2,000, isn't 1 × $1,100. Fix the quantity or the cost each, or ignore the Total column.",
    });
  });

  it("doesn't check a cost range against the total", () => {
    const p = preview(["Item,Qty,Cost,Total", "Dishwasher,12,$650-$800,$9000"].join("\n"));
    expect(byName(p, "Dishwasher").issues).toEqual([]);
  });
});

describe("an unknown install year next to an age", () => {
  it("uses the age, and falls back to the year built only when nothing else gives a year", () => {
    const sheet = ["Item,Year installed,Age", "Fridge,unknown,8", "Range,unknown,", "Dishwasher,2019,3"].join("\n");
    const p = preview(sheet, { sheetYear: 2024 });
    expect(byName(p, "Refrigerator").row).toMatchObject({ installYear: "2016", installYearIsGuess: true });
    expect(byName(p, "Range / oven").row).toMatchObject({ installYear: "", installYearIsGuess: false });
    expect(byName(p, "Range / oven").changes).toContain('Read "unknown" as no install year, so it uses the year built, marked an estimate');
    expect(byName(p, "Dishwasher").row).toMatchObject({ installYear: "2019", installYearIsGuess: false });
  });
});

describe("identical rows", () => {
  it("merge into one row with a quantity, with the apartments in the notes", () => {
    const sheet = ["Apt,Item,Year,Cost,Condition,Notes", "1A,Water heater,2014,1400,Good,", "2B,Water heater,2014,1400,Good,Leaks", "3C,Water heater,2014,1400,Fair,"].join("\n");
    const p = preview(sheet);
    expect(p.rows.map((r) => [r.row.quantity, r.row.condition, r.row.notes])).toEqual([
      ["2", "good", "Apt: 1A and 2B\n2B: Leaks"],
      ["1", "fair", "Apt: 3C"],
    ]);
  });

  it("keep their notes under 2,000 characters, ending in …and N more", () => {
    const rows = Array.from({ length: 600 }, (_, i) => `Apartment ${1000 + i},Water heater,2014,1400`);
    const p = preview(["Unit,Item,Year,Cost", ...rows].join("\n"));
    expect(p.rows).toHaveLength(1);
    const { notes, quantity } = p.rows[0].row;
    expect(quantity).toBe("600");
    expect(notes.length).toBeLessThanOrEqual(MAX_NOTES_LENGTH);
    expect(notes).toMatch(/^Unit: Apartment 1000, Apartment 1001, .* …and \d+ more$/);
  });

  it("keep quantities as the sheet gives them", () => {
    const p = preview(["Item,Qty,Year", "Fridge,10,2015", "Fridge,2,2015"].join("\n"));
    expect(p.rows[0].row.quantity).toBe("12");
    expect(preview(["Item,Qty", "Fridge,7"].join("\n")).rows[0].row.quantity).toBe("7");
  });
});

describe("fitting notes", () => {
  it("lists every apartment when they fit", () => {
    expect(locationLine("Apt", ["1", "2", "3"], 100)).toBe("Apt: 1, 2 and 3");
    expect(locationLine("Apt", ["101", "102", "103", "104"], 25)).toBe("Apt: 101, 102 …and 2 more");
  });

  it("says how many notes didn't fit, and cuts one long note rather than losing it", () => {
    const long = "x".repeat(3000);
    expect(mergedNotes("Apt", [{ location: "", details: [long] }])).toHaveLength(MAX_NOTES_LENGTH);
    const many = Array.from({ length: 50 }, (_, i) => ({ location: `${i}`, details: ["y".repeat(100)] }));
    const notes = mergedNotes("Apt", many);
    expect(notes.length).toBeLessThanOrEqual(MAX_NOTES_LENGTH);
    expect(notes).toMatch(/\n…and \d+ more notes$/);
  });
});
