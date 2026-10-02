import { inflateRawSync } from "node:zlib";
import readExcelFile from "read-excel-file/universal";
import { COMPONENT_LIBRARY } from "@/lib/library/components";
import { createInTurn, createSummary, createLabel, MAX_PROPERTIES, planProperty, plannedProblems, plannedSave, startingName, withEdits } from "../buildings";
import { CURRENT_YEAR, match } from "../__fixtures__/sheets";
import { xlsxFile, type FixtureTab } from "../__fixtures__/xlsx";
import { openSheet, startingChoices, type OpenedSheet } from "../open";
import { buildPreview, type ImportChoices, type Preview } from "../preview";
import { MAX_COLUMNS } from "../read";
import { openTabs, startingTabs, tabNote, tabRowCounts } from "../tabs";
import {
  parseSheetStates,
  readWorkbook,
  sheetStates,
  sniff,
  tabsFromWorkbook,
  tooWide,
  xlsxProblem,
  zipEntry,
  type Inflate,
  type SheetState,
  type Tab,
} from "../xlsx";

/** zlib in place of the browser's DecompressionStream. */
const inflate: Inflate = async (bytes) => new Uint8Array(inflateRawSync(bytes));

async function read(tabs: FixtureTab[]): Promise<Tab[]> {
  const result = await readWorkbook(xlsxFile(tabs), readExcelFile, inflate);
  if (typeof result === "string") throw new Error(`readWorkbook failed: ${result}`);
  return result;
}

function open(tab: Tab): OpenedSheet {
  const opened = openSheet(tab.grid, match, CURRENT_YEAR);
  if (typeof opened === "string") throw new Error(`openSheet failed: ${opened}`);
  return opened;
}

function previewOf(tab: Tab, changes: Partial<ImportChoices> = {}): Preview {
  const opened = open(tab);
  return buildPreview(opened.sheet, { ...startingChoices(opened, CURRENT_YEAR), ...changes }, COMPONENT_LIBRARY, match, CURRENT_YEAR);
}

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("reading an .xlsx file", () => {
  it("lists every tab by name, with numbers, dates and yes/no cells as Excel keeps them", async () => {
    const tabs = await read([
      {
        name: "Maple Court",
        rows: [
          ["Item", "Qty", "Installed", "Life", "Cost each", "Guess?"],
          ["Water heater", 12, utc(2016, 1, 1), 10, 1400, false],
          ["Furnace", 12, utc(2014, 6, 15), 18, 4200, true],
        ],
      },
      { name: "Notes", rows: [["Call the roofer in May"]] },
    ]);
    expect(tabs.map((t) => t.name)).toEqual(["Maple Court", "Notes"]);
    const [, water, furnace] = tabs[0].grid;
    expect(water[1]).toBe(12);
    expect(water[2]).toBeInstanceOf(Date);
    expect(furnace[5]).toBe(true);
  });

  it("reads a date's year as the sheet shows it, whatever this computer's time zone", async () => {
    // January 1 at midnight is still the year before in time zones west of London.
    const [tab] = await read([{ name: "List", rows: [["Item", "Qty", "Installed", "Life", "Cost each"], ["Water heater", 12, utc(2016, 1, 1), 10, 1400]] }]);
    const p = previewOf(tab);
    expect(p.rows[0].row.installYear).toBe("2016");
  });

  it("trims the empty cells and rows Excel leaves at the ends", async () => {
    const [tab] = await read([{ name: "List", rows: [["Item", "Qty", null, ""], ["Roof", 1, null, null], [null, null], ["", ""]] }]);
    expect(tab.grid).toEqual([
      ["Item", "Qty"],
      ["Roof", 1],
    ]);
  });

  it("says a workbook with nothing in it is empty", async () => {
    expect(await readWorkbook(xlsxFile([{ name: "Sheet1", rows: [] }]), readExcelFile)).toBe("empty_file");
  });

  it("sends old .xls files and password-locked files to Save As", async () => {
    const office = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    expect(sniff(office)).toBe("office");
    expect(await readWorkbook(office.buffer, readExcelFile)).toBe("unsupported");
  });

  it("says a damaged file can't be read, and an empty one is empty", async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6]);
    expect(sniff(zip)).toBe("zip");
    expect(await readWorkbook(zip.buffer, readExcelFile)).toBe("unreadable");
    expect(await readWorkbook(new ArrayBuffer(0), readExcelFile)).toBe("empty_file");
    expect(await readWorkbook(new TextEncoder().encode("Item,Qty").buffer as ArrayBuffer, readExcelFile)).toBe("unreadable");
  });

  it("knows read-excel-file's errors", () => {
    const error = (code: string) => Object.assign(new Error(code), { name: "InvalidInputError", code });
    expect(xlsxProblem(error("XLS_FILE_NOT_SUPPORTED"))).toBe("unsupported");
    expect(xlsxProblem(error("NO_DATA"))).toBe("empty_file");
    expect(xlsxProblem(error("INVALID_ZIP"))).toBe("unreadable");
    expect(xlsxProblem("nope")).toBe("unreadable");
  });

  it("checks what the reader gives back, since its result isn't typed", () => {
    expect(tabsFromWorkbook(null)).toBe("unreadable");
    expect(tabsFromWorkbook([{ sheet: "A", data: "x" }])).toBe("unreadable");
    expect(tabsFromWorkbook([{ sheet: "", data: [["Item"]] }])).toEqual([{ name: "Sheet1", grid: [["Item"]] }]);
    expect(tabsFromWorkbook([{ sheet: "A", data: [] }])).toBe("empty_file");
  });

  it("reads one file out of a zip, stored or deflated as Excel saves it", async () => {
    const tabs: FixtureTab[] = [{ name: "List", rows: [["Item"]] }];
    for (const deflate of [false, true]) {
      const file = xlsxFile(tabs, { deflate });
      const xml = await zipEntry(file, "xl/workbook.xml", inflate);
      expect(new TextDecoder().decode(xml ?? new Uint8Array())).toContain('<sheet name="List"');
      expect(await zipEntry(file, "xl/missing.xml", inflate)).toBeNull();
    }
    expect(await zipEntry(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2]).buffer, "xl/workbook.xml", inflate)).toBeNull();
  });

  it("lists each sheet's name and whether it's hidden, decoding what XML escapes", () => {
    const xml =
      '<workbook><bookViews><workbookView/></bookViews><sheets>' +
      '<sheet name="Maple &amp; Oak" sheetId="1" r:id="rId1"/>' +
      '<sheet name="Lookups" sheetId="2" state="hidden" r:id="rId2"/>' +
      "<x:sheet name='Macro data' state='veryHidden' sheetId='3' r:id='rId3'/>" +
      '<sheet name="Shown" state="visible" sheetId="4" r:id="rId4"></sheet>' +
      "</sheets></workbook>";
    expect(parseSheetStates(xml)).toEqual([
      { name: "Maple & Oak", hidden: false },
      { name: "Lookups", hidden: true },
      { name: "Macro data", hidden: true },
      { name: "Shown", hidden: false },
    ]);
  });

  it("marks hidden tabs, and reads them anyway", async () => {
    const workbook: FixtureTab[] = [
      { name: "Maple Court", rows: [["Item", "Qty", "Year installed", "Cost"], ["Roof", 1, 2008, 38000]] },
      { name: "Hidden calc", state: "hidden", rows: [["Item", "Qty", "Year installed", "Cost"], ["Roof", 1, 2008, 1]] },
      { name: "Very hidden", state: "veryHidden", rows: [["Item", "Qty"], ["Roof", 1]] },
    ];
    for (const deflate of [false, true]) {
      const tabs = await readWorkbook(xlsxFile(workbook, { deflate }), readExcelFile, inflate);
      if (typeof tabs === "string") throw new Error(tabs);
      expect(tabs.map((t) => [t.name, t.hidden === true, t.grid.length])).toEqual([
        ["Maple Court", false, 2],
        ["Hidden calc", true, 2],
        ["Very hidden", true, 2],
      ]);
    }
    // Without a way to unpack it, or when it can't be read, no tab is marked.
    const plain = await readWorkbook(xlsxFile(workbook, { deflate: true }), readExcelFile);
    if (typeof plain === "string") throw new Error(plain);
    expect(plain.some((t) => t.hidden)).toBe(false);
    const broken: Inflate = () => Promise.reject(new Error("no DecompressionStream"));
    expect(await sheetStates(xlsxFile(workbook, { deflate: true }), broken)).toBeNull();
  });

  it("uses the hidden marks only when they list the same sheets as the reader", () => {
    const raw = [
      { sheet: "A", data: [["Item"]] },
      { sheet: "B", data: [["Item"]] },
    ];
    const hidden = (states: SheetState[]) => {
      const tabs = tabsFromWorkbook(raw, states);
      return typeof tabs === "string" ? tabs : tabs.map((t) => t.hidden === true);
    };
    expect(hidden([{ name: "A", hidden: false }, { name: "B", hidden: true }])).toEqual([false, true]);
    expect(hidden([{ name: "B", hidden: true }])).toEqual([false, false]);
    expect(hidden([{ name: "A", hidden: false }, { name: "C", hidden: true }])).toEqual([false, false]);
  });

  it("won't read a tab wider than a component list could be", () => {
    expect(tooWide({ name: "Wide", grid: [Array.from({ length: MAX_COLUMNS + 1 }, (_, i) => `C${i}`)] })).toBe(true);
    expect(tooWide({ name: "List", grid: [["Item", "Qty"]] })).toBe(false);
  });
});

/** Made-up buildings: one tab each, with the generic headings owners use. */
const ONE_TAB_EACH: FixtureTab[] = [
  {
    name: "Maple Court",
    rows: [
      ["Maple Court, 12 units"],
      [],
      ["Item", "Qty", "Year installed", "Life", "Cost each"],
      ["Water heater", 12, 2016, 10, 1400],
      ["Furnace", 12, 2014, 18, 4200],
    ],
  },
  {
    name: "Oak Street",
    rows: [
      ["Item", "Qty", "Year installed", "Life", "Cost each"],
      ["Asphalt shingle roof", 1, 2008, 22, 38000],
    ],
  },
  { name: "Sheet3", rows: [["Phone numbers, no headings"], ["Roofer: 555-0100"]] },
];

describe("the tab picker", () => {
  const workbook: FixtureTab[] = [
    { name: "Notes", rows: [["Call the roofer in May"]] },
    { name: "Lookups", state: "hidden", rows: [["Item", "Qty", "Year installed", "Cost"], ["Roof", 1, 2008, 1], ["Furnace", 1, 2008, 1]] },
    {
      name: "Maple Court",
      rows: [
        ["Item", "Qty", "Year installed", "Cost each"],
        ["Water heater", 12, 2016, 1400],
        ["Furnace", 12, 2014, 4200],
        [],
        ["Roof", 1, 2008, 38000],
        ["Total", null, null, 43600],
      ],
    },
    { name: "Empty", rows: [] },
  ];

  it("counts the rows each tab would import, leaving out totals and blank rows", async () => {
    const tabs = await read(workbook);
    const opened = openTabs(tabs, match, CURRENT_YEAR);
    const rows = tabRowCounts(opened, COMPONENT_LIBRARY, match, CURRENT_YEAR);
    expect(rows).toEqual([null, 2, 3, null]);
    expect(tabs.map((t, i) => tabNote(t, opened[i], rows[i]))).toEqual(["no headings found", "hidden, 2 rows", "3 rows", "empty"]);
  });

  it("counts identical rows once, as the preview adds them", () => {
    const tab: Tab = { name: "Apts", grid: [["Item", "Unit", "Year installed"], ["Fridge", "1A", 2014], ["Fridge", "1B", 2014], ["Fridge", "2A", 2019]] };
    const opened = openTabs([tab], match, CURRENT_YEAR);
    expect(tabRowCounts(opened, COMPONENT_LIBRARY, match, CURRENT_YEAR)).toEqual([2]);
  });

  it("starts with the tabs that can be read, leaving hidden ones out unless they're all there is", async () => {
    const tabs = await read(workbook);
    expect(startingTabs(tabs, openTabs(tabs, match, CURRENT_YEAR))).toEqual([2]);
    const onlyHidden = tabs.filter((t) => t.name !== "Maple Court");
    expect(startingTabs(onlyHidden, openTabs(onlyHidden, match, CURRENT_YEAR))).toEqual([1]);
  });
});

describe("a workbook with one tab per building", () => {
  it("opens each building's tab, and says which can't be read", async () => {
    const tabs = await read(ONE_TAB_EACH);
    const opened = tabs.map((t) => openSheet(t.grid, match, CURRENT_YEAR));
    expect(opened.map((o) => (typeof o === "string" ? o : "ok"))).toEqual(["ok", "ok", "no_header"]);
  });

  it("plans a property for each tab, named after it", async () => {
    const tabs = await read(ONE_TAB_EACH);
    const planned = tabs.slice(0, 2).map((tab, i) => {
      const p = previewOf(tab);
      expect(p.buildings).toHaveLength(1);
      return planProperty(i, p.buildings[0], p.rows.map((r) => r.row), { tab: tab.name, file: "portfolio.xlsx" });
    });
    expect(planned.map((p) => [p.name, p.rows.length, p.unitCount])).toEqual([
      ["Maple Court", 2, ""],
      ["Oak Street", 1, ""],
    ]);
    // Each needs a unit count and year built before it can be created.
    expect(plannedProblems(planned[0], CURRENT_YEAR)).toEqual(["Type how many rental units it has."]);
    expect(plannedProblems(withEdits(planned[0], { name: " ", unitCount: "0" }), CURRENT_YEAR)).toEqual([
      "Give the property a name.",
      "Type how many rental units it has.",
    ]);
    expect(plannedProblems(withEdits(planned[0], { unitCount: "12", yearBuilt: "1700" }), CURRENT_YEAR)).toEqual([
      expect.stringMatching(/^Year built must be/),
    ]);
    const ready = withEdits(planned[0], { unitCount: "12", yearBuilt: "1998" });
    expect(plannedProblems(ready, CURRENT_YEAR)).toEqual([]);
    const save = plannedSave(ready, CURRENT_YEAR);
    expect(save.property).toMatchObject({ name: "Maple Court", unit_count: 12, year_built: 1998 });
    expect(save.components).toHaveLength(2);
  });
});

/** Made-up buildings in one tab, named only on each building's first row, as with merged cells. */
const BUILDING_COLUMN: FixtureTab = {
  name: "All buildings",
  rows: [
    ["Building", "Units", "Year built", "Item", "Qty", "Year installed", "Life", "Cost each"],
    ["12 Elm St", 4, 1962, "Water heater", 4, 2015, 10, 1300],
    [null, null, null, "Gas furnace", 4, utc(2011, 1, 1), 18, 4000],
    ["40 Birch Ave", "6 units", "approx 1985", "Asphalt shingle roof", 1, 2009, 22, 30000],
    [null, null, null, "Refrigerator", 6, 2019, 13, 900],
    [null, 7, null, "Dishwasher", 6, 2019, 10, 700],
    ["12 ELM ST.", null, null, "Carpet", 2400, 2020, 8, 4],
  ],
};

describe("one tab with a Building column", () => {
  it("lists each building with its unit count and year built, filling names down", async () => {
    const [tab] = await read([BUILDING_COLUMN]);
    const p = previewOf(tab);
    expect(open(tab).columns.slice(0, 3)).toEqual(["building", "unitCount", "yearBuilt"]);
    expect(p.buildings).toEqual([
      { key: "12 elm st", name: "12 Elm St", unitCount: 4, yearBuilt: 1962, records: 3, notes: [] },
      {
        key: "40 birch ave",
        name: "40 Birch Ave",
        unitCount: 6,
        yearBuilt: 1985,
        records: 3,
        notes: ["Rows give more than one unit count. We used the first, 6."],
      },
    ]);
    expect(p.rows.map((r) => r.building)).toEqual(["12 elm st", "12 elm st", "40 birch ave", "40 birch ave", "40 birch ave", "12 elm st"]);
  });

  it("shows one building at a time in the calculator, skipping the others' rows", async () => {
    const [tab] = await read([BUILDING_COLUMN]);
    const p = previewOf(tab, { building: "40 birch ave" });
    expect(p.rows.map((r) => r.row.name)).toEqual(["Asphalt shingle roof", "Refrigerator", "Dishwasher"]);
    expect(p.skipped.filter((s) => s.reason === "other_building").map((s) => s.sheetRow)).toEqual([2, 3, 7]);
    // Every building is still listed, so the owner can choose another.
    expect(p.buildings.map((b) => b.name)).toEqual(["12 Elm St", "40 Birch Ave"]);
  });

  it("plans a property for each building, ready to create", async () => {
    const [tab] = await read([BUILDING_COLUMN]);
    const all = previewOf(tab);
    const planned = all.buildings.map((b) => {
      const p = previewOf(tab, { building: b.key });
      return planProperty(0, b, p.rows.map((r) => r.row), { tab: tab.name, file: "buildings.xlsx" });
    });
    expect(planned.map((p) => [p.id, p.name, p.unitCount, p.yearBuilt, p.rows.length])).toEqual([
      ["0:12 elm st", "12 Elm St", "4", "1962", 3],
      ["0:40 birch ave", "40 Birch Ave", "6", "1985", 3],
    ]);
    for (const p of planned) expect(plannedProblems(p, CURRENT_YEAR)).toEqual([]);
  });
});

describe("naming the properties and saying how it went", () => {
  const building = { key: "", name: "", unitCount: null, yearBuilt: null, records: 1, notes: [] };

  it("uses the building, then the tab, then the file", () => {
    expect(startingName({ ...building, name: "Maple Court" }, "Tab", "file.xlsx")).toBe("Maple Court");
    expect(startingName(building, "Oak Street", "file.xlsx")).toBe("Oak Street");
    expect(startingName(building, "Sheet1", "Pine Ridge.xlsx")).toBe("Pine Ridge");
    expect(startingName(building, "Sheet 2", null)).toBe("Sheet 2");
    expect(startingName(building, null, null)).toBe("Imported property");
  });

  it("names the rows that stop a property being created", () => {
    const planned = planProperty(0, { ...building, unitCount: 4, yearBuilt: 1990 }, [], { tab: "A", file: null });
    const withBadRow = {
      ...planned,
      rows: [
        {
          librarySlug: null,
          category: "Other",
          name: "Boiler",
          quantity: "1",
          unitLabel: "per_building" as const,
          installYear: "2010",
          installYearIsGuess: false,
          usefulLife: "",
          costEach: "9000",
          condition: null,
          notes: "",
          replaceNow: false,
        },
      ],
    };
    expect(plannedProblems(withBadRow, CURRENT_YEAR)).toEqual([expect.stringMatching(/^Fix Boiler in the preview first\. /)]);
  });

  it("counts what was created and what failed", () => {
    expect(createSummary([{ status: "created", propertyId: "x", components: 3, detailsDropped: false }])).toBe("Created 1 property.");
    expect(
      createSummary([
        { status: "created", propertyId: "x", components: 3, detailsDropped: false },
        { status: "created", propertyId: "y", components: 1, detailsDropped: false },
        { status: "failed", failure: "network" },
      ]),
    ).toBe("Created 2 properties. 1 didn't save.");
    expect(createLabel(1)).toBe("Create 1 property");
  });

  it("creates them one at a time, and stops sending once signed out", async () => {
    const sent: string[] = [];
    const results: [string, string][] = [];
    await createInTurn(
      ["a", "b", "c", "d"],
      async (id) => {
        sent.push(id);
        if (id === "b") return { status: "failed", failure: "network" };
        if (id === "c") return { status: "failed", failure: "signed_out" };
        return { status: "created", propertyId: `p-${id}`, components: 1, detailsDropped: false };
      },
      (id, r) => results.push([id, r.status === "created" ? r.propertyId : r.failure]),
    );
    expect(sent).toEqual(["a", "b", "c"]);
    expect(results).toEqual([
      ["a", "p-a"],
      ["b", "network"],
      ["c", "signed_out"],
      ["d", "signed_out"],
    ]);
    expect(createLabel(MAX_PROPERTIES)).toBe("Create 20 properties");
  });
});
