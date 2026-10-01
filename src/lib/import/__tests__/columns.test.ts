import {
  columnValues,
  componentSlug,
  doubtfulQuantity,
  doubtfulQuantityColumn,
  findHeaderRow,
  guessColumns,
  guessField,
  guessLayout,
  headingItem,
  headings,
  headingTiming,
  isCounting,
  offersColumnLayout,
  parseRole,
  samples,
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
