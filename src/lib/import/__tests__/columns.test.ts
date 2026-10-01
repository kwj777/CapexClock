import {
  componentSlug,
  findHeaderRow,
  guessColumns,
  guessField,
  guessLayout,
  headingItem,
  headings,
  headingTiming,
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

  it.each(["Tenant", "Tenant name", "Phone", "Rent", "Year built", "Warranty", "Units", "Building", "", "Whatever", "constructor"])(
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
