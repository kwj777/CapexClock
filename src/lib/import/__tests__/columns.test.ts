import {
  columnValues,
  componentSlug,
  doubtfulQuantity,
  doubtfulQuantityColumn,
  doubtfulYearColumns,
  findHeaderRow,
  guessColumns,
  guessField,
  guessHeading,
  guessLayout,
  headingItem,
  headings,
  headingTiming,
  isCounting,
  offersColumnLayout,
  parseRole,
  sameUnitsColumn,
  samples,
  yearsHavePassed,
} from "../columns";
import { match } from "../__fixtures__/sheets";

describe("guessing a column from its heading", () => {
  it.each([
    ["Item", "item"],
    ["Component", "item"],
    ["Description", "item"],
    ["Qty", "quantity"],
    ["Quantity", "quantity"],
    ["# of units", "quantity"],
    ["No. of units", "quantity"],
    ["Count", "quantity"],
    ["Unit", "location"],
    ["Unit #", "location"],
    ["Apt", "location"],
    ["Apt.", "location"],
    ["Year installed", "installYear"],
    ["Install date", "installYear"],
    ["Installed", "installYear"],
    ["Year", "installYear"],
    ["Last replaced", "installYear"],
    ["Year replaced", "installYear"],
    ["Age", "age"],
    ["Age (yrs)", "age"],
    ["Years old", "age"],
    ["Useful life", "life"],
    ["EUL", "life"],
    ["Expected life (yrs)", "life"],
    ["Life expectancy", "life"],
    ["Remaining life", "remaining"],
    ["Remaining useful life", "remaining"],
    ["RUL", "remaining"],
    ["Years left", "remaining"],
    ["Replace by", "replaceBy"],
    ["Replacement year", "replaceBy"],
    ["Year to replace", "replaceBy"],
    ["Due", "replaceBy"],
    ["Cost", "cost"],
    ["Cost each", "cost"],
    ["Unit cost", "cost"],
    ["Cost per unit", "cost"],
    ["Replacement cost", "cost"],
    ["Est. cost", "cost"],
    ["Price", "cost"],
    ["Total", "total"],
    ["Total cost", "total"],
    ["Total replacement cost", "total"],
    ["Condition", "condition"],
    ["Notes", "notes"],
    ["Comments", "notes"],
    ["Model", "notes"],
    ["Category", "category"],
  ])("reads %p as %p", (heading, field) => {
    expect(guessField(heading)).toBe(field);
  });

  it.each(["Tenant", "Tenant name", "Phone", "Rent", "Year built", "Warranty", "Units", "Building", "", "Whatever", "constructor", "#", "No.", "Item #", "Item no.", "Line", "Ref #", "ID"])(
    "leaves %p unguessed",
    (heading) => {
      expect(guessField(heading)).toBeNull();
    },
  );

  it.each([
    "Last service date",
    "Service date",
    "Serviced",
    "Inspection date",
    "Date inspected",
    "Last inspected",
    "Maintenance year",
    "Next service due",
    "Service cost",
    "Repair cost",
    "Date tested",
    "Last cleaned",
    "Septic pumped",
    "Move-in date",
    "Lease end",
    "Warranty end date",
  ])("leaves %p out: a service, inspection or tenant date isn't an install year", (heading) => {
    expect(guessField(heading)).toBeNull();
  });

  it.each([
    ["Last replacement year", "installYear"],
    ["Last replacement date", "installYear"],
    ["Date of last replacement", "installYear"],
    ["Previous replacement", "installYear"],
    ["Install/replace year", "installYear"],
    ["Install or replacement year", "installYear"],
    ["Year last replaced", "installYear"],
    ["Replaced on", "installYear"],
    ["Date purchased", "installYear"],
    ["In-service date", "installYear"],
    ["Placed in service", "installYear"],
    ["Years in service", "age"],
    ["Years since installed", "age"],
    ["Service life", "life"],
    ["Remaining service life", "remaining"],
    ["Condition at last inspection", "condition"],
    ["Inspection notes", "notes"],
    ["Planned year", "replaceBy"],
    ["Budget year", "replaceBy"],
    ["Budget", "cost"],
    ["Projected replacement year", "replaceBy"],
    ["Next replacement", "replaceBy"],
    ["Year of replacement", "replaceBy"],
    ["Qty installed", "quantity"],
    ["When", "installYear"],
  ])("reads %p as %p", (heading, field) => {
    expect(guessField(heading)).toBe(field);
  });

  it("says how sure a heading is", () => {
    expect(guessHeading("Year installed").strength).toBe("sure");
    expect(guessHeading("Year").strength).toBe("weak");
    expect(guessHeading("Yr").strength).toBe("weak");
    expect(guessHeading("Date").strength).toBe("doubtful");
    expect(guessHeading("Purchase date").strength).toBe("sure");
    expect(guessHeading("Date of record").strength).toBe("doubtful");
    expect(guessHeading("Replacement year").strength).toBe("doubtful");
    expect(guessHeading("Replace by").strength).toBe("sure");
  });
});

describe("headings that name a library item", () => {
  it("finds the item and how its cells give the year", () => {
    expect(headingItem("Water heater installed", match)).toBe("tank-water-heater");
    expect(headingItem("Furnace installed", match)).toBe("gas-furnace");
    expect(headingItem("Fridge", match)).toBe("refrigerator");
    expect(headingItem("WH age", match)).toBe("tank-water-heater");
    expect(headingTiming("WH age")).toBe("age");
    expect(headingTiming("Water heater installed")).toBe("installYear");
  });

  it("doesn't take field headings or unsure names for items", () => {
    expect(headingItem("Year installed", match)).toBeNull();
    expect(headingItem("Cost", match)).toBeNull();
    expect(headingItem("Roof", match)).toBeNull();
  });

  it("doesn't take a column of service dates for a column of install years", () => {
    expect(headingItem("Water heater service date", match)).toBeNull();
    expect(headingItem("Furnace inspected", match)).toBeNull();
    expect(headingItem("Fridge purchased", match)).toBe("refrigerator");
  });
});

describe("finding the heading row", () => {
  it("skips a title block above the headings", () => {
    const grid = [["Maple Court CapEx"], ["Updated 2024"], [], ["Item", "Qty", "Year installed", "Cost"], ["Roof", "1", "2008", "38000"]];
    expect(findHeaderRow(grid, match)).toBe(3);
    expect(headings(grid, 3)).toEqual(["Item", "Qty", "Year installed", "Cost"]);
  });

  it("finds headings that start with a row-number column", () => {
    const grid = [["Pine Ridge"], ["#", "Item", "Qty"], ["1", "Fridge", "12"]];
    expect(findHeaderRow(grid, match)).toBe(1);
  });

  it("finds item headings in a sheet with a column per item", () => {
    const grid = [["Apt", "Water heater installed", "Furnace installed"], ["101", "2014", "2012"]];
    expect(findHeaderRow(grid, match)).toBe(0);
  });

  it("finds nothing when the headings weren't copied", () => {
    expect(findHeaderRow([["Water heater", "12", "2016", "$1,400"], ["Roof", "1", "2008", "$38,000"]], match)).toBeNull();
    expect(findHeaderRow([], match)).toBeNull();
  });
});

describe("guessing the layout and every column", () => {
  const itemHeads = ["Item", "Qty", "Year installed", "Unit cost", "Replacement cost", "Notes", "Comments", "Tenant"];
  const aptHeads = ["Apt", "Tenant", "Water heater installed", "Furnace installed", "Fridge", "Notes"];

  it("guesses each column, using only the first of each kind but every notes column", () => {
    expect(guessColumns(itemHeads, match, "rows")).toEqual([
      "item",
      "quantity",
      "installYear",
      "cost",
      "ignore",
      "notes",
      "notes",
      "ignore",
    ]);
  });

  it("offers each column as a component when two or more headings name items", () => {
    expect(offersColumnLayout(aptHeads, match)).toBe(true);
    expect(offersColumnLayout(itemHeads, match)).toBe(false);
    expect(guessLayout(aptHeads, match)).toBe("columns");
    expect(guessLayout(itemHeads, match)).toBe("rows");
    expect(guessColumns(aptHeads, match, "columns")).toEqual([
      "location",
      "ignore",
      "component:tank-water-heater",
      "component:gas-furnace",
      "component:refrigerator",
      "ignore",
    ]);
  });

  it("keeps a sheet with an item column one row per item, even with item headings", () => {
    expect(guessLayout(["Item", "Water heater", "Furnace"], match)).toBe("rows");
  });

  it("doesn't take a row-number column for the quantity", () => {
    const grid = [
      ["#", "Item", "Qty", "Year installed", "Cost each"],
      ["1", "Water heater", "12", "2016", "$1,400"],
      ["2", "Gas furnace", "12", "2012", "$4,200"],
      ["3", "Boiler", "1", "2010", "$60,000"],
    ];
    const heads = headings(grid, 0);
    expect(guessColumns(heads, match, "rows", columnValues(grid, 0))).toEqual(["ignore", "item", "quantity", "installYear", "cost"]);
    // Even before the values are looked at, a heading that says quantity wins.
    expect(guessColumns(["No.", "Description", "Quantity", "Install year"], match, "rows")).toEqual([
      "ignore",
      "item",
      "quantity",
      "installYear",
    ]);
    expect(guessColumns(["Item", "Qty", "#"], match, "rows")).toEqual(["item", "quantity", "ignore"]);
  });

  it("uses a # or Units column as the quantity only when no heading names one and the values are counts", () => {
    const sheet = (head: string, values: string[]) => {
      const grid = [["Item", head], ...values.map((v, i) => [`Item ${i}`, v])];
      return guessColumns(headings(grid, 0), match, "rows", columnValues(grid, 0))[1];
    };
    expect(sheet("#", ["1", "2", "3", "4"])).toBe("ignore");
    expect(sheet("No.", ["101", "102", "103"])).toBe("ignore");
    expect(sheet("#", ["12", "1", "24"])).toBe("quantity");
    expect(sheet("#", ["A1", "A2", "B1"])).toBe("ignore");
    expect(sheet("Units", ["12", "1", "24", "12"])).toBe("quantity");
    // The same number on every row is the building's unit count.
    expect(sheet("Units", ["12", "12", "12"])).toBe("ignore");
    expect(sheet("Units", ["12"])).toBe("ignore");
    expect(sheet("#", [])).toBe("ignore");
  });

  it("names the quantity column when its heading only might mean one", () => {
    expect(doubtfulQuantityColumn(["Item", "#"], ["item", "quantity"])).toBe(1);
    expect(doubtfulQuantityColumn(["Item", "Units"], ["item", "quantity"])).toBe(1);
    expect(doubtfulQuantityColumn(["Item", "Qty"], ["item", "quantity"])).toBeNull();
    expect(doubtfulQuantityColumn(["Item", "#"], ["item", "ignore"])).toBeNull();
    expect(doubtfulQuantity("No.")).toBe("number");
    expect(doubtfulQuantity("Units")).toBe("units");
    expect(doubtfulQuantity("# of units")).toBeNull();
  });

  it("knows numbering when it sees it", () => {
    expect(isCounting(["1", "2", "3"])).toBe(true);
    expect(isCounting(["1.", "2.", "3.", "4."])).toBe(true);
    expect(isCounting(["101", "102", "103"])).toBe(true);
    expect(isCounting(["1", "2"])).toBe(false);
    expect(isCounting(["1", "1", "1"])).toBe(false);
    expect(isCounting(["12", "1", "2"])).toBe(false);
    expect(isCounting(["1", "2", "x"])).toBe(false);
  });

  it("uses # or No. as the apartment in a sheet with a column per item", () => {
    expect(guessColumns(["#", "Water heater installed", "Furnace installed"], match, "columns")).toEqual([
      "location",
      "component:tank-water-heater",
      "component:gas-furnace",
    ]);
    expect(guessColumns(["Apt", "No.", "Water heater installed"], match, "columns")).toEqual([
      "location",
      "ignore",
      "component:tank-water-heater",
    ]);
  });

  it("reads a System column as the item names when there's no item column", () => {
    expect(guessColumns(["System", "Qty", "Year installed", "Cost"], match, "rows")).toEqual(["item", "quantity", "installYear", "cost"]);
    expect(guessColumns(["Category", "Building system", "Qty"], match, "rows")).toEqual(["category", "item", "quantity"]);
    expect(guessColumns(["Item", "System"], match, "rows")).toEqual(["item", "category"]);
  });

  it("takes the surest year heading, not the first one", () => {
    const grid = [
      ["Item", "Qty", "Inspection date", "Year installed", "Cost"],
      ["Water heater", "12", "3/1/2025", "2014", "$1,400"],
    ];
    expect(guessColumns(headings(grid, 0), match, "rows", columnValues(grid, 0), 2026)).toEqual([
      "item",
      "quantity",
      "ignore",
      "installYear",
      "cost",
    ]);
    expect(guessColumns(["Item", "Date", "Year installed"], match, "rows")).toEqual(["item", "ignore", "installYear"]);
    expect(guessColumns(["Item", "Year", "Install date"], match, "rows")).toEqual(["item", "ignore", "installYear"]);
    expect(guessColumns(["Item", "Date", "Year"], match, "rows")).toEqual(["item", "ignore", "installYear"]);
    // Equally sure: the first one.
    expect(guessColumns(["Item", "Installed", "Year installed"], match, "rows")).toEqual(["item", "installYear", "ignore"]);
    expect(guessColumns(["Item", "Due", "Replacement year"], match, "rows")).toEqual(["item", "replaceBy", "ignore"]);
  });

  it("reads a Replacement year column of past years as when each item was last replaced", () => {
    const sheet = (head: string, values: string[], others: string[] = []) => {
      const grid = [["Item", ...others, head], ...values.map((v) => ["Fridge", ...others.map(() => "2010"), v])];
      return guessColumns(headings(grid, 0), match, "rows", columnValues(grid, 0), 2026).at(-1);
    };
    expect(sheet("Replacement year", ["2016", "2019", "2008"])).toBe("installYear");
    expect(sheet("Replacement date", ["3/1/2016", "2020-05-01"])).toBe("installYear");
    expect(sheet("Replacement year", ["2016", "2031"])).toBe("replaceBy");
    expect(sheet("Replacement year", ["2026"])).toBe("replaceBy");
    expect(sheet("Replacement year", ["2016", "ASAP"])).toBe("replaceBy");
    expect(sheet("Replacement year", ["unknown"])).toBe("replaceBy");
    // A sure heading isn't second-guessed.
    expect(sheet("Replace by", ["2016", "2019"])).toBe("replaceBy");
    // With an install year column already, it's the year to replace by.
    expect(sheet("Replacement year", ["2016", "2019"], ["Year installed"])).toBe("replaceBy");
    // Without this year, there's nothing to compare with.
    expect(guessColumns(["Item", "Replacement year"], match, "rows", () => ["2016"])).toEqual(["item", "replaceBy"]);
  });

  it("knows when every year in a column has gone by", () => {
    expect(yearsHavePassed(["2016", "approx 2019", "", "orig"], 2026)).toBe(true);
    expect(yearsHavePassed(["2016", "2026"], 2026)).toBe(false);
    expect(yearsHavePassed(["2016", "now"], 2026)).toBe(false);
    expect(yearsHavePassed(["unknown"], 2026)).toBe(false);
    expect(yearsHavePassed([], 2026)).toBe(false);
  });

  it("names year columns whose headings could mean something else", () => {
    const heads = ["Item", "Date", "Replacement year", "Year installed"];
    expect(doubtfulYearColumns(heads, ["item", "installYear", "replaceBy", "ignore"])).toEqual([
      { column: 1, heading: "Date", role: "installYear" },
      { column: 2, heading: "Replacement year", role: "replaceBy" },
    ]);
    expect(doubtfulYearColumns(heads, ["item", "ignore", "ignore", "installYear"])).toEqual([]);
  });

  it("finds a Units column with the same number on every row, which could be the building's unit count", () => {
    const values = (cells: Record<number, string[]>) => (c: number) => cells[c] ?? [];
    expect(sameUnitsColumn(["Item", "Units"], ["item", "ignore"], values({ 1: ["12", "12", "12"] }))).toEqual({ column: 1, value: "12" });
    // Asked again after the owner chose Quantity, so the answer shows.
    expect(sameUnitsColumn(["Item", "Units"], ["item", "quantity"], values({ 1: ["12", "12"] }))).toEqual({ column: 1, value: "12" });
    expect(sameUnitsColumn(["Item", "Units"], ["item", "ignore"], values({ 1: ["12", "6"] }))).toBeNull();
    expect(sameUnitsColumn(["Item", "Units"], ["item", "ignore"], values({ 1: ["1", "1"] }))).toBeNull();
    expect(sameUnitsColumn(["Item", "Units"], ["item", "ignore"], values({ 1: ["twelve"] }))).toBeNull();
    expect(sameUnitsColumn(["Item", "Units", "Qty"], ["item", "ignore", "quantity"], values({ 1: ["12"] }))).toBeNull();
    expect(sameUnitsColumn(["Item", "Units"], ["item", "notes"], values({ 1: ["12"] }))).toBeNull();
    expect(sameUnitsColumn(["Item", "Qty"], ["item", "quantity"], values({ 1: ["12"] }))).toBeNull();
  });

  it("reads a dropdown's value back as a role", () => {
    expect(parseRole("cost")).toBe("cost");
    expect(parseRole("component:boiler")).toBe("component:boiler");
    expect(parseRole("component:")).toBe("ignore");
    expect(parseRole("whatever")).toBe("ignore");
  });

  it("reads a component column's role back to its item", () => {
    expect(componentSlug("component:boiler")).toBe("boiler");
    expect(componentSlug("cost")).toBeNull();
  });

  it("shows a few different values from a column", () => {
    const grid = [["Year"], ["2014"], [""], ["2014"], ["approx 2012"], ["orig"], ["1999"]];
    expect(samples(grid, 0, 0)).toEqual(["2014", "approx 2012", "orig"]);
  });
});
