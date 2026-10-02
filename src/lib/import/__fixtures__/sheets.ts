/**
 * Made-up landlord sheets in the layouts real owners use. Names, addresses and
 * numbers are invented; real owner sheets are never committed.
 */
import Papa from "papaparse";
import { COMPONENT_LIBRARY } from "@/lib/library/components";
import { createMatcher } from "../names";
import { openSheet, startingChoices, type OpenedSheet } from "../open";
import { buildPreview, type ImportChoices, type Preview } from "../preview";
import { readText, type CsvParse, type ImportSource } from "../read";

export const CURRENT_YEAR = 2026;

export const parse: CsvParse = (text, delimiter) => {
  const result = Papa.parse<unknown[]>(text, { delimiter, skipEmptyLines: false });
  return { data: result.data, errors: result.errors };
};

export const match = createMatcher(COMPONENT_LIBRARY);

/** Copied from Excel: tab-separated, with a title block, a blank row and a totals row. */
export const ITEM_ROWS = [
  "Maple Court Apartments - CapEx list",
  "Updated March 2024",
  "",
  "Item\tQty\tYear installed\tUseful life\tCost each\tTotal\tCondition\tNotes",
  "Roof\t1\tapprox 2008\t22\t$38,000\t$38,000\tFair\tPatched 2019",
  "Water heater\t12\t2016\t10\t$1,400 ea\t$16,800\tGood\t",
  "Fridge\t12\torig\t\t1.4k\t\tok\t",
  "Furnace\t12\tJun-14\t18\t$4,200\t\tPoor\t",
  "Carpet\t\"9,600 sq ft\"\t2020\t8\t$4 per sq ft\t\t\t",
  "\t\t\t\t\t\t\t",
  "Elevator\t1\t1998\t25\tcall\t\t\t",
  "Dishwaser\t12\t2019\t\t$650-$800\t\t\t",
  "Total\t\t\t\t\t$120,000\t\t",
].join("\n");

/** One row per apartment, with a column per item, saved as CSV. The tenant column is never read. */
export const APARTMENT_ROWS = [
  "Apt,Tenant,Water heater installed,Furnace installed,Fridge,Dishwasher",
  "101,J. Smith,2014,2012,approx 2018,N",
  "102,A. Jones,2014,2012,approx 2018,Y",
  "103,,2016,unknown,2018,2020",
  "104,,2014,2012,approx 2018,",
  "105,,,,,",
].join("\n");

/** Ages instead of install years. */
export const AGE_ROWS = [
  "Component,# of units,Age (yrs),Replacement cost",
  'Water heaters,24,8 yrs old,"$1,400"',
  'Roof,1,12,"$45,000"',
  "AC units,24,approx 5,3.5k",
  'Boiler,1,new,"$60,000"',
].join("\n");

/** Expected and remaining useful life, as reserve studies give them. */
export const REMAINING_ROWS = [
  "Description,Qty,EUL,RUL,Unit cost",
  'Asphalt shingle roof,1,25,5,"$40,000"',
  'Gutters,1,,10,"$3,000"',
  "Parking lot seal coat,12000 sf,,0,$0.25",
  'Siding,1,,50,"$30,000"',
  'Elevator,1,,8,"$90,000"',
].join("\n");

/** Replace-by years, with a range and "ASAP". */
export const REPLACE_BY_ROWS = [
  "Item,Count,Replace by,Est. cost",
  "Dishwasher,12,2030,$650",
  "Range,12,ASAP,$900",
  'Windows,12,2028-2030,"$3,200"',
  "Gas furnace,12,2040,\"$4,000\"",
].join("\n");

/** Copied from Excel with the rows numbered, and a total at the foot. The numbers aren't quantities. */
export const NUMBERED_ROWS = [
  "#\tItem\tQty\tYear installed\tCost each",
  "1\tWater heater\t12\t2016\t$1,400",
  "2\tGas furnace\t12\t2012\t$4,200",
  "3\tBoiler\t1\t2010\t$60,000",
  "4\tTotal CapEx\t\t\t$124,800",
].join("\n");

/** A reserve-study style list: "No.", "Description", "Quantity", subtotals and a SUM with no label. */
export const STUDY_ROWS = [
  "Oak Street 8-plex reserve study",
  "No.,Description,Quantity,Install year,Unit cost,Total",
  ' 1,Asphalt shingle roof,1,2009,"$32,000","$32,000"',
  ' 2,Gutters,1,1990s,"$2,800","$2,800"',
  ',Subtotal - exterior,,,,"$34,800"',
  ' 3,Carpet,6400 sq ft,pre-2000,$4,"$25,600"',
  ' 4,Interior paint,8,early 2000s,"$2,500","$20,000"',
  ',Subtotal - interiors,,,,"$45,600"',
  ',,,,,"$80,400"',
  ',Total replacement cost,,,,"$80,400"',
].join("\n");

/** Opens a sheet the way the panel does, failing the test if it can't. */
export function open(text: string, source: ImportSource = "file"): OpenedSheet {
  const grid = readText(text, parse, source);
  if (typeof grid === "string") throw new Error(`readText failed: ${grid}`);
  const opened = openSheet(grid, match, CURRENT_YEAR);
  if (typeof opened === "string") throw new Error(`openSheet failed: ${opened}`);
  return opened;
}

export function preview(text: string, changes: Partial<ImportChoices> = {}, source: ImportSource = "file"): Preview {
  const opened = open(text, source);
  return buildPreview(opened.sheet, { ...startingChoices(opened, CURRENT_YEAR), ...changes }, COMPONENT_LIBRARY, match, CURRENT_YEAR);
}
